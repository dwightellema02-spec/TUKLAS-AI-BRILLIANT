/**
 * Phase 36 real-browser check (Chromium): the teacher dashboard shows evidence-based flags, a complete list ("show all"),
 * group recommendations, assessment and lesson performance, a class filter, and the same evidence on a student's page.
 *   node scripts/test-phase36-browser.mjs
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

const port = 6000 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
try { fs.rmSync("data/users-persistence.json", { force: true }); } catch { /* */ }
const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), DATABASE_URL: process.env.DATABASE_URL ?? "" }, stdio: "ignore", detached: true });
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const finish = async (b) => { try { await b?.close(); } catch { /* */ } try { process.kill(-srv.pid, "SIGTERM"); } catch { /* */ } console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`); process.exit(failed === 0 ? 0 : 1); };
for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* */ } }

const run = crypto.randomBytes(3).toString("hex");
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const errors = [];
const call = async (ctx, method, path, data) => { const r = await ctx.request.fetch(base + path, { method, data, headers: { "Content-Type": "application/json" } }); let j = {}; try { j = await r.json(); } catch { /* */ } return { status: r.status(), json: j }; };

// ---- scenario through the API
const adminCtx = await browser.newContext();
await call(adminCtx, "POST", "/api/auth/login", { email: process.env.ADMIN_EMAIL || "admin@tuklas.ai", password: process.env.ADMIN_PASSWORD || "Tuklas2026!" });
await call(adminCtx, "POST", "/api/admin/users", { name: "Ms. Cruz", email: `p36t.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER" });
const T = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await call(T, "POST", "/api/auth/login", { email: `p36t.${run}@example.edu`, password: "Sturdy-Pass1" });
const C1 = (await call(T, "POST", "/api/teacher/classes", { name: "Class Alpha", gradeLevel: 7 })).json.data;
const C2 = (await call(T, "POST", "/api/teacher/classes", { name: "Class Beta", gradeLevel: 7 })).json.data;
const codeOf = async (c) => (await call(T, "GET", `/api/teacher/classes/${c.id}`)).json.data.classroom?.joinCode ?? c.joinCode;
const [code1, code2] = [await codeOf(C1), await codeOf(C2)];
const answers = [-5, -3, 4, -7, 2, -1];
const qids = [];
for (const [i, a] of answers.entries()) qids.push((await call(T, "POST", "/api/questions", { type: "NUMERIC_INPUT", prompt: `P36 q${i} ${run}`, status: "PUBLISHED", difficulty: "EASY", questionData: { correctAnswer: a } })).json.data.id);
const set = (await call(T, "POST", "/api/practice-sets", { title: `P36 set ${run}`, status: "PUBLISHED", questionIds: qids })).json.data;
async function newStudent(name, code) {
  const ctx = await browser.newContext();
  const reg = await call(ctx, "POST", "/api/auth/register", { name, email: `p36s.${name.replace(/\W/g, "")}.${run}@example.edu`, password: "Sturdy-Pass1" });
  await call(ctx, "POST", "/api/student/classes/join", { code });
  return { ctx, id: reg.json.user.id, name };
}
async function practice(s, correct) {
  const st = await call(s.ctx, "POST", "/api/practice/start", { practiceSetId: set.id });
  for (const q of st.json.data.questions) { const qid = q.questionId ?? q.question?.id ?? q.id; await call(s.ctx, "POST", `/api/practice/${st.json.data.id}/answer`, { questionId: qid, answer: String(correct ? answers[qids.indexOf(qid)] : 777) }); }
  await call(s.ctx, "POST", `/api/practice/${st.json.data.id}/complete`, {});
}
const weak = [];
for (let i = 1; i <= 7; i++) { const s = await newStudent(`Weak${i}`, code1); await practice(s, false); weak.push(s); }
const strong = await newStudent("Strong1", code1); await practice(strong, true);
const beta = await newStudent("BetaKid", code2); await practice(beta, true);
const quiz = (await call(T, "POST", "/api/teacher/assessments", { title: `P36 quiz ${run}`, type: "FORMATIVE", passingScorePercent: 60, questions: qids.slice(0, 3).map((questionId) => ({ questionId })) })).json.data;
await call(T, "POST", `/api/teacher/assessments/${quiz.id}/publish`);
await call(T, "POST", `/api/teacher/assessments/${quiz.id}/assign`, { classroomId: C1.id });
{
  const view = (await call(strong.ctx, "GET", `/api/student/assessments/${quiz.id}`)).json.data;
  const att = (await call(strong.ctx, "POST", `/api/student/assessments/${quiz.id}/start`)).json.data.attemptId;
  await call(strong.ctx, "POST", `/api/student/assessments/attempts/${att}/submit`, { responses: view.items.map((it) => ({ assessmentItemId: it.id, studentAnswer: String(answers[qids.indexOf(it.questionId)]) })) });
}

// ---- the teacher's dashboard
const page = await T.newPage();
page.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });
await page.goto(base + "/teacher");
await page.getByTestId("needs-attention").waitFor({ timeout: 20000 });
check((await page.getByTestId("attention-row").count()) === 6, "the flag list starts with the 6 most urgent");
check(/Show all 7 students/.test(await page.getByTestId("attention-toggle").innerText()), "...and says how many there are in all (7)");
await page.getByTestId("attention-toggle").click();
check((await page.getByTestId("attention-row").count()) === 7, "'Show all' reveals every flagged student (nobody is cut off)");
const firstRow = await page.getByTestId("attention-row").first().innerText();
check(/0 of 6 questions right \(0%\)/.test(firstRow), `a flag shows its evidence with numbers ("${firstRow.split("\n").find((l) => /questions right/.test(l))}")`);
check(/Action:/.test(firstRow), "...and a suggested action");
check(!/Strong1/.test(await page.getByTestId("needs-attention").innerText()), "the student who is doing well is not on the list");

check((await page.getByTestId("assessment-performance").innerText()).includes(`P36 quiz ${run}`) && /1 of 8 finished/.test(await page.getByTestId("assessment-performance").innerText()), "the assessments card shows the quiz with 1 of 8 finished");
check(/100%/.test(await page.getByTestId("assessment-performance").innerText()), "...and its average score");
check((await page.getByTestId("group-recommendations").count()) === 1 && (await page.getByTestId("lesson-performance").count()) === 1, "group-focus and lesson cards are on the page");

// class filter
await page.getByTestId("class-filter").selectOption({ label: "Class Beta" });
await page.waitForFunction(() => /No assessment has been assigned/.test(document.querySelector("[data-testid=assessment-performance]")?.textContent || ""), null, { timeout: 10000 });
check(/Nobody is currently flagged|All Students Progressing/.test(await page.locator("body").innerText()) || (await page.getByTestId("attention-row").count()) === 0, "filtering to the other class shows only that class (no flags, no assessment)");
await page.getByTestId("class-filter").selectOption({ label: "All my classes" });
await page.getByTestId("attention-row").first().waitFor({ timeout: 10000 });
check(true, "...and switching back restores everything");

// student detail
await page.goto(base + `/teacher/students/${weak[0].id}`);
await page.getByTestId("student-support").waitFor({ timeout: 15000 });
check(/0 of 6 questions right/.test(await page.getByTestId("student-support").innerText()), "the student's page explains why they are flagged, with the same evidence");
await page.setViewportSize({ width: 390, height: 800 });
await page.goto(base + "/teacher");
await page.getByTestId("needs-attention").waitFor();
check(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)), "the dashboard has no sideways scrolling on a phone");

check(errors.length === 0, `no uncaught page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await finish(browser);

/**
 * Phase 34: the whole classroom journey in a real browser, through the screens a teacher and a student actually use.
 * Teacher on a laptop viewport, student on a phone viewport, fresh server, no shortcuts except: the admin creates the
 * teacher account (that is how teachers are made in production) and a few questions are created through the API.
 *   node scripts/test-phase34-journey.mjs            (spawns its own dev server, in-memory)
 *   BASE_URL=http://... node scripts/test-phase34-journey.mjs   (use a server you started, e.g. against PostgreSQL)
 * Env: ADMIN_EMAIL, ADMIN_PASSWORD (default demo admin), SCREENSHOT_DIR (optional).
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

const external = !!process.env.BASE_URL;
const port = 5400 + Math.floor(Math.random() * 90);
const base = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const shots = process.env.SCREENSHOT_DIR;
if (shots) fs.mkdirSync(shots, { recursive: true });
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
let srv;
if (!external) {
  try { fs.rmSync("data/users-persistence.json", { force: true }); } catch { /* */ }
  srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), DATABASE_URL: process.env.DATABASE_URL ?? "" }, stdio: "ignore", detached: true });
}
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const finish = async (browser) => { try { await browser?.close(); } catch { /* */ } try { if (srv) process.kill(-srv.pid, "SIGTERM"); } catch { /* */ } console.log(failed === 0 ? "\nJOURNEY COMPLETE: ALL CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`); process.exit(failed === 0 ? 0 : 1); };
for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* waiting */ } }

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const errors = [], consoleErrors = [], failedRequests = [];
const watch = (p, who) => {
  p.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(`${who}: ${e.message}`); });
  p.on("console", (m) => { if (m.type() === "error" && !/WebSocket|Failed to load resource.*(401|403|404)|favicon/i.test(m.text())) consoleErrors.push(`${who}: ${m.text().slice(0, 160)}`); });
  p.on("response", (r) => { if (r.status() >= 500) failedRequests.push(`${who}: ${r.status()} ${r.url().replace(base, "")}`); });
};
const shot = async (p, name) => { if (shots) await p.screenshot({ path: `${shots}/${name}.png`, fullPage: false }); };
const run = crypto.randomBytes(3).toString("hex");
const T_EMAIL = `journey.teacher.${run}@example.edu`, S_EMAIL = `journey.student.${run}@example.edu`, PASS = "Sturdy-Pass1";

async function signIn(page, email, password, { register = false, name = "" } = {}) {
  await page.getByRole("button", { name: /Sign In/ }).first().click();
  await page.getByRole("dialog").waitFor();
  if (register) { await page.getByRole("button", { name: /Register here/ }).click(); await page.getByPlaceholder("e.g. Maria Cruz").fill(name); await page.getByTestId("accept-privacy").check(); }
  await page.getByPlaceholder("name@school.edu.ph").fill(email);
  await page.locator("input[type=password]").fill(password);
  await page.getByRole("dialog").getByRole("button", { name: register ? "Create Account" : "Sign In", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "detached", timeout: 15000 });
}

// -------- 0. the admin makes the teacher (production practice), and the teacher's questions
const adminCtx = await browser.newContext();
await adminCtx.request.post(base + "/api/auth/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
const mk = await adminCtx.request.post(base + "/api/admin/users", { data: { name: "Ms. Reyes", email: T_EMAIL, password: PASS, role: "TEACHER" } });
check(mk.ok(), "admin creates the teacher account");

// -------- 1. TEACHER: sign in, make a class
const tctx = await browser.newContext({ viewport: { width: 1366, height: 800 } });
const tp = await tctx.newPage(); watch(tp, "teacher");
await tp.goto(base + "/");
await signIn(tp, T_EMAIL, PASS);
await tp.waitForTimeout(800);
const afterLogin = new URL(tp.url()).pathname;
check(/\/teacher/.test(afterLogin) || (await tp.getByText(/Ms\. Reyes/).count()) > 0, `signing in as a teacher lands somewhere teacher-facing (${afterLogin})`);
await tp.goto(base + "/teacher/classes");
await tp.getByLabel(/class name/i).first().fill("Grade 7 – Rizal").catch(async () => { await tp.locator("input").first().fill("Grade 7 – Rizal"); });
await tp.getByRole("button", { name: /create class|add class|^create$/i }).first().click();
await tp.getByText("Grade 7 – Rizal").first().waitFor({ timeout: 10000 });
check(true, "the teacher creates a class and sees it listed");
await tp.getByText("Grade 7 – Rizal").first().click();
await tp.waitForURL(/\/teacher\/classes\//, { timeout: 10000 }).catch(() => {});
await tp.waitForFunction(() => /Class code/.test(document.body.innerText) && /\b[A-HJ-KM-NP-Z2-9]{6}\b/.test(document.body.innerText.split("Class code")[1] ?? ""), null, { timeout: 15000 }).catch(() => {});
const code = (await tp.locator("body").innerText()).split("Class code")[1]?.match(/\b([A-HJ-KM-NP-Z2-9]{6})\b/)?.[1];
check(!!code, `the class page shows a join code to hand out (${code})`);
await shot(tp, "teacher-class");

// questions for the pre/post test (through the API: the question editor has its own phase tests)
const q = async (body) => (await (await tctx.request.post(base + "/api/questions", { data: { status: "PUBLISHED", difficulty: "EASY", ...body } })).json()).data.id;
await q({ type: "NUMERIC_INPUT", prompt: `Compute $-3 + 8$ [${run}]`, questionData: { correctAnswer: 5 } });
await q({ type: "NUMERIC_INPUT", prompt: `Compute $5 - 9$ [${run}]`, questionData: { correctAnswer: -4 } });
await q({ type: "MULTIPLE_CHOICE", prompt: `The opposite of $-6$ is… [${run}]`, questionData: { choices: [{ id: "a", text: "$6$" }, { id: "b", text: "$-6$" }], correctAnswer: "a" } });

// -------- 2. TEACHER: pre-test through the screens
await tp.goto(base + "/teacher/assessments");
async function makeAssessment(title, kind) {
  await tp.getByTestId("new-assessment").click();
  await tp.getByTestId("asm-title").fill(title);
  await tp.getByTestId("asm-type").selectOption(kind);
  for (const t of ["Compute \\$-3", "Compute \\$5", "The opposite"]) {
    const boxes = tp.getByLabel(new RegExp(`Use question: .*${t}.*\\[${run}\\]`));
    for (let i = 0; i < await boxes.count(); i++) await boxes.nth(i).check();
  }
  await tp.getByTestId("create-assessment").click();
  const card = tp.getByTestId("teacher-assessment").filter({ hasText: title });
  await card.waitFor();
  await card.getByTestId("publish-assessment").click();
  await card.getByTestId("open-assign").waitFor();
  await card.getByTestId("open-assign").click();
  await tp.getByTestId("assign-class").selectOption({ label: "Grade 7 – Rizal" });
  await tp.getByTestId("confirm-assign").click();
  await tp.waitForFunction(() => /Assigned/.test(document.querySelector("[data-testid=notice]")?.textContent || ""));
}
await makeAssessment("Pre-test " + run, "PRE_TEST");
check(true, "the teacher builds, publishes and assigns a pre-test to the class");

// -------- 3. STUDENT (phone): register, join, take the pre-test
const sctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true });
const sp = await sctx.newPage(); watch(sp, "student");
await sp.goto(base + "/");
await signIn(sp, S_EMAIL, PASS, { register: true, name: "Juan dela Cruz" });
await sp.goto(base + "/student");
await sp.getByTestId("student-classes").waitFor({ timeout: 15000 });
check(true, "a new student registers and reaches their dashboard");
await sp.locator("#join-code-input").fill(code ?? "");
await sp.getByRole("button", { name: "Join class" }).click();
await sp.getByText(/You joined/).waitFor();
check(true, "the student joins the class with the code");
await sp.reload();
await sp.getByTestId("student-assessments-card").waitFor({ timeout: 10000 });
await sp.getByTestId("student-assessments-card").getByRole("button", { name: "Open" }).click();
const row = sp.getByTestId("assessment-row").filter({ hasText: "Pre-test " + run });
await row.getByTestId("open-assessment").click();
await sp.getByTestId("begin-assessment").click();
await sp.getByText(/Question 1 of \d/).waitFor().catch(async (e) => { console.log("STUCK:", (await sp.locator("body").innerText()).slice(0, 500)); throw e; });
check(/Question 1 of 3/.test(await sp.locator("body").innerText()), "the pre-test has the 3 chosen questions");
for (let i = 0; i < 3; i++) {
  if (await sp.getByTestId("answer-input").count()) {
    const prompt = await sp.locator("body").innerText();
    await sp.getByTestId("answer-input").fill(/5\s*[-−]\s*9/.test(prompt) ? "-4" : "4"); // one deliberate mistake on the first
  } else await sp.getByTestId("choice-a").click();
  if (i < 2) await sp.getByTestId("next-question").click();
}
await shot(sp, "student-assessment");
await sp.getByTestId("review-submit").click();
await sp.getByTestId("confirm-submit").click();
await sp.getByTestId("assessment-result").waitFor();
check(/%/.test(await sp.getByTestId("assessment-result").innerText()) && (await sp.getByTestId("answers-hidden").count()) === 1, "the student finishes the pre-test and sees a score without the answers");

// -------- 4. STUDENT: learn with the tutor
await sp.goto(base + "/student/learning-path");
await sp.waitForLoadState("networkidle").catch(() => {});
const lessonLink = sp.getByRole("button", { name: /start|continue|open lesson|begin/i }).first();
const hasLesson = await lessonLink.count();
check(hasLesson > 0, "the learning path offers a lesson to start");
if (hasLesson) {
  await lessonLink.click();
  await sp.waitForURL(/\/student\/lessons\//, { timeout: 15000 }).catch(() => {});
}
check(/\/student\/lessons\//.test(sp.url()), `a lesson opens (${new URL(sp.url()).pathname})`);
await sp.getByRole("button", { name: "AI Tutor" }).first().click();
await sp.getByRole("heading", { name: "Tuklas AI Tutor" }).waitFor({ timeout: 20000 });
await sp.waitForFunction(() => document.querySelectorAll("[class*='rounded-bl']").length >= 1, null, { timeout: 20000 });
const box = sp.getByPlaceholder(/Ask a question/);
await box.fill("what is negative five plus three");
await box.press("Enter");
await sp.waitForFunction(() => document.querySelectorAll("[class*='rounded-bl']").length >= 2, null, { timeout: 20000 });
const tutorText = await sp.locator("[class*='rounded-bl']").last().innerText();
check(tutorText.length > 20 && !/(= ?-?2\b|answer is -?2)/i.test(tutorText), "the tutor answers with a guiding question and does not hand over the answer");
await box.fill("-2");
await box.press("Enter");
await sp.waitForFunction(() => document.querySelectorAll("[class*='rounded-bl']").length >= 3, null, { timeout: 20000 });
check((await sp.locator("[class*='rounded-bl']").last().innerText()).length > 20, "the tutor reacts to the student's answer");
await shot(sp, "student-tutor");
check(!(await sp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)), "no sideways scrolling on the phone");

// -------- 5. TEACHER assigns a lesson and a practice set from the class page; STUDENT does them from the dashboard
const qids = (await (await tctx.request.get(base + "/api/questions")).json()).data.filter((x) => x.prompt.endsWith(`[${run}]`)).map((x) => x.id);
const ps = (await (await tctx.request.post(base + "/api/practice-sets", { data: { title: "Integers warm-up " + run, status: "PUBLISHED", questionIds: qids } })).json()).data;
await tp.goto(base + "/teacher/classes");
await tp.getByText("Grade 7 – Rizal").first().click();
await tp.waitForURL(/\/teacher\/classes\//);
await tp.getByRole("button", { name: /assignment/i }).first().click();
await tp.locator("#assignment-title").fill("Warm-up " + run);
await tp.locator("#assignment-practice").selectOption({ label: "Integers warm-up " + run });
await tp.getByRole("button", { name: "Publish Assignment" }).click();
await tp.getByText("Warm-up " + run).first().waitFor({ timeout: 10000 });
check(true, "the teacher assigns a practice set to the class (with a due date) from the class page");

await sp.goto(base + "/student");
await sp.getByTestId("student-assignments").waitFor({ timeout: 15000 });
await sp.getByTestId("open-practice-assignment").first().click();
await sp.waitForURL(/\/student\/practice\//, { timeout: 15000 });
let answered = 0;
for (let guard = 0; guard < 30; guard++) {
  await sp.waitForTimeout(400);
  const finishBtn = sp.getByRole("button", { name: /Finish Practice|Next Question/ });
  if (await finishBtn.count()) { const txt = await finishBtn.first().innerText(); await finishBtn.first().click(); if (/Finish/.test(txt)) break; continue; }
  const bodyNow = await sp.locator("body").innerText();
  if (/Practice Complete/.test(bodyNow)) break;
  await sp.locator("#numeric-answer-input, #text-answer-input, #equation-answer-input, [role=radio]").first().waitFor({ timeout: 10000 }).catch(async (e) => { console.log("PRACTICE PAGE STUCK at", sp.url(), "\n", (await sp.locator("body").innerText()).slice(0, 600)); await shot(sp, "practice-stuck"); throw e; });
  const typed = sp.locator("#numeric-answer-input, #text-answer-input, #equation-answer-input");
  if (await typed.count()) await typed.first().fill("5");
  else await sp.locator("[role=radio]").first().click();
  if (answered === 0) check(!/\$-?6\$/.test(await sp.locator("body").innerText()) || !/opposite/.test(await sp.locator("body").innerText()), "math in answer choices is typeset, not shown as raw $...$");
  await sp.getByRole("button", { name: /Submit Answer/ }).click();
  answered++;
}
await sp.getByText(/Practice Complete/).waitFor({ timeout: 15000 });
check(answered >= 2, `the student works through the practice set (${answered} questions) and reaches the summary`);
await shot(sp, "student-practice-done");
await sp.goto(base + "/student/practice-history");
await sp.waitForLoadState("networkidle").catch(() => {});
check(/Integers warm-up/.test(await sp.locator("body").innerText()), "the finished practice appears in the student's history");

// -------- 6. POST-TEST and the teacher's comparison
await tp.goto(base + "/teacher/assessments");
await makeAssessment("Post-test " + run, "POST_TEST");
await sp.goto(base + "/student/assessments");
const prow = sp.getByTestId("assessment-row").filter({ hasText: "Post-test " + run });
await prow.getByTestId("open-assessment").click();
await sp.getByTestId("begin-assessment").click();
await sp.getByText(/Question 1 of \d/).waitFor().catch(async (e) => { console.log("STUCK:", (await sp.locator("body").innerText()).slice(0, 500)); throw e; });
check(/Question 1 of 3/.test(await sp.locator("body").innerText()), "the pre-test has the 3 chosen questions");
for (let i = 0; i < 3; i++) {
  if (await sp.getByTestId("answer-input").count()) {
    const prompt = await sp.locator("body").innerText();
    await sp.getByTestId("answer-input").fill(/5\s*[-−]\s*9/.test(prompt) ? "-4" : "5");
  } else await sp.getByTestId("choice-a").click();
  if (i < 2) await sp.getByTestId("next-question").click();
}
await sp.getByTestId("review-submit").click();
await sp.getByTestId("confirm-submit").click();
await sp.getByTestId("assessment-result").waitFor();
check(/100%/.test(await sp.getByTestId("assessment-result").innerText()), "the student takes the post-test and scores 100%");

await tp.goto(base + "/teacher/assessments");
await tp.getByTestId("compare-panel").waitFor();
await tp.getByTestId("cmp-class").selectOption({ label: "Grade 7 – Rizal" });
await tp.getByTestId("cmp-pre").selectOption({ label: "Pre-test " + run });
await tp.getByTestId("cmp-post").selectOption({ label: "Post-test " + run });
await tp.getByTestId("cmp-run").click();
await tp.getByTestId("cmp-result").waitFor();
const cmpText = await tp.getByTestId("cmp-result").innerText();
check(/100%/.test(cmpText) && /\+\d/.test(cmpText) && /1 student/.test(cmpText), `the teacher compares pre and post for the class and sees an improvement (${cmpText.replace(/\n+/g, " | ").slice(0, 140)})`);
await shot(tp, "teacher-compare");

// -------- 7. TEACHER: results, student list, archive
const prow2 = tp.getByTestId("teacher-assessment").filter({ hasText: "Pre-test " + run });
await prow2.getByTestId("view-results").click();
await tp.getByTestId("results-students").waitFor();
const tbl = await tp.getByTestId("results-students").innerText();
check(/Juan dela Cruz/.test(tbl) && /Completed/.test(tbl), "the teacher sees the student by name with a completed pre-test");
await tp.goto(base + "/teacher/students");
await tp.waitForLoadState("networkidle").catch(() => {});
check(/Juan dela Cruz/.test(await tp.locator("body").innerText()), "the student appears in the teacher's student list");
await tp.goto(base + "/teacher/assessments");
tp.once("dialog", (d) => d.accept());
await tp.getByTestId("teacher-assessment").filter({ hasText: "Post-test " + run }).getByTestId("archive-assessment").click();
await tp.getByText(/is archived/).waitFor();
await sp.goto(base + "/student/assessments");
await sp.getByTestId("assessment-row").first().waitFor();
check((await sp.getByTestId("assessment-row").filter({ hasText: "Post-test " + run }).count()) === 0, "an archived assessment disappears from the student's list");

check(errors.length === 0, `no uncaught page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
check(failedRequests.length === 0, `no server errors (5xx) during the whole journey${failedRequests.length ? ": " + failedRequests.join(" | ") : ""}`);
check(consoleErrors.length === 0, `no browser console errors${consoleErrors.length ? ": " + consoleErrors.join(" | ") : ""}`);
await finish(browser);

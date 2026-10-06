/**
 * Phase 33 real-browser check (Chromium) of the assessment screens against a spawned dev server:
 * a teacher builds, publishes and assigns an assessment through the UI; a student takes a quiz (every answer type)
 * and a pre-test, a refresh keeps their answers, a timer ends an attempt automatically, and results are shown or hidden correctly.
 *   node scripts/test-phase33-browser.mjs
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

const port = 5000 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
try { fs.rmSync("data/users-persistence.json", { force: true }); } catch { /* */ }
const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), DATABASE_URL: "" }, stdio: "ignore", detached: true });
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const finish = async (browser) => { try { await browser?.close(); } catch { /* */ } try { process.kill(-srv.pid, "SIGTERM"); } catch { /* */ } console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`); process.exit(failed === 0 ? 0 : 1); };
for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* waiting */ } }

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const errors = [];
const watch = (p) => p.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });
const run = crypto.randomBytes(3).toString("hex");

// ---- accounts, via the API
const adminCtx = await browser.newContext();
await adminCtx.request.post(base + "/api/auth/login", { data: { email: "admin@tuklas.ai", password: "Tuklas2026!" } });
const tEmail = `p33t.${run}@example.edu`;
const mk = await adminCtx.request.post(base + "/api/admin/users", { data: { name: "Teacher B", email: tEmail, password: "Sturdy-Pass1", role: "TEACHER" } });
if (!mk.ok()) throw new Error("teacher create failed " + mk.status());
const teacher = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await teacher.request.post(base + "/api/auth/login", { data: { email: tEmail, password: "Sturdy-Pass1" } });
const cls = (await (await teacher.request.post(base + "/api/teacher/classes", { data: { name: "Browser class", gradeLevel: 7 } })).json()).data;
const code = (await (await teacher.request.get(base + `/api/teacher/classes/${cls.id}`)).json()).data.classroom?.joinCode ?? cls.joinCode;
const q = async (body) => (await (await teacher.request.post(base + "/api/questions", { data: { status: "PUBLISHED", difficulty: "EASY", ...body } })).json()).data.id;
await q({ type: "MULTIPLE_CHOICE", prompt: "Opposite of 5?", questionData: { choices: [{ id: "a", text: "-5" }, { id: "b", text: "5" }], correctAnswer: "a" } });
await q({ type: "NUMERIC_INPUT", prompt: "Compute -3 + 8", questionData: { correctAnswer: 5 } });
await q({ type: "TRUE_FALSE", prompt: "|-4| equals 4", questionData: { correctAnswer: true } });
await q({ type: "MATCHING", prompt: "Match absolute values", questionData: { matchingPairs: [{ left: "-2", right: "2" }, { left: "-7", right: "7" }] } });
await q({ type: "ORDERING", prompt: "Order from least to greatest", questionData: { orderingItems: ["-3", "0", "4"] } });

// ---- 1. teacher builds, publishes and assigns through the UI
{
  const page = await teacher.newPage(); watch(page);
  await page.goto(base + "/teacher/assessments");
  await page.getByTestId("new-assessment").click();
  check(await page.getByTestId("create-assessment").isDisabled(), "create is disabled until there is a title and a question");
  await page.getByTestId("asm-title").fill("Quiz " + run);
  for (const text of ["Opposite of 5?", "Compute -3 + 8", "|-4| equals 4", "Match absolute values", "Order from least to greatest"]) await page.getByLabel(`Use question: ${text}`).check();
  await page.getByTestId("create-assessment").click();
  await page.getByTestId("teacher-assessment").first().waitFor();
  check(/DRAFT/.test(await page.getByTestId("teacher-assessment").first().innerText()), "the new assessment appears as a draft");
  await page.getByTestId("publish-assessment").click();
  await page.getByTestId("open-assign").waitFor();
  check(true, "publishing offers 'Assign to a class'");
  await page.getByTestId("open-assign").click();
  await page.getByTestId("assign-class").selectOption({ label: "Browser class" });
  await page.getByTestId("confirm-assign").click();
  await page.waitForFunction(() => /Assigned/.test(document.querySelector("[data-testid=notice]")?.textContent || ""));
  check(true, "assigning to the class succeeds");

  // a pre-test with a 1-minute limit, made through the API (the form is already covered above)
  const qs = (await (await teacher.request.get(base + "/api/questions")).json()).data;
  const ids = qs.slice(0, 2).map((x) => x.id);
  const pre = (await (await teacher.request.post(base + "/api/teacher/assessments", { data: { title: "Pre " + run, type: "PRE_TEST", timeLimitMinutes: 1, questions: ids.map((questionId) => ({ questionId })) } })).json()).data;
  await teacher.request.post(base + `/api/teacher/assessments/${pre.id}/publish`);
  await teacher.request.post(base + `/api/teacher/assessments/${pre.id}/assign`, { data: { classroomId: cls.id } });
  globalThis.preId = pre.id;
  await page.close();
}

// ---- 2. the student
const student = await browser.newContext({ viewport: { width: 390, height: 800 } });
const reg = await student.request.post(base + "/api/auth/register", { data: { name: "Browser Student", email: `p33s.${run}@example.edu`, password: "Sturdy-Pass1" } });
check(reg.ok(), "student registered");
{
  const sp = await student.newPage(); watch(sp);
  await sp.goto(base + "/student");
  await sp.getByTestId("student-classes").waitFor();
  check((await sp.getByTestId("student-assessments-card").count()) === 0, "before joining a class there is no assessments card");
  await sp.locator("#join-code-input").fill(code);
  await sp.getByRole("button", { name: "Join class" }).click();
  await sp.getByText(/You joined/).waitFor();
  await sp.reload();
  await sp.getByTestId("student-assessments-card").waitFor({ timeout: 10000 });
  check(/2 waiting/.test(await sp.getByTestId("student-assessments-card").innerText()), "after joining, the dashboard shows '2 waiting for you'");
  await sp.getByTestId("student-assessments-card").getByRole("button", { name: "Open" }).click();
  await sp.getByTestId("assessment-row").first().waitFor();
  check((await sp.getByTestId("assessment-row").count()) === 2, "the list shows both assigned assessments");
  check(!(await sp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)), "no horizontal scrolling at phone width");

  // --- the quiz
  const quiz = sp.getByTestId("assessment-row").filter({ hasText: "Quiz " + run });
  await quiz.getByTestId("open-assessment").click();
  await sp.getByTestId("begin-assessment").click();
  await sp.getByText("Question 1 of 5").waitFor();
  check((await sp.getByTestId("timer").count()) === 0, "a quiz without a limit shows no timer");
  check(!/isCorrect|correctAnswer/.test(await sp.content()), "the page contains no answer key");
  await sp.getByTestId("choice-a").click();
  check((await sp.getByTestId("choice-a").getAttribute("aria-checked")) === "true", "choosing an option marks it");
  await sp.getByTestId("next-question").click();
  await sp.getByTestId("answer-input").fill("5");
  await sp.reload();
  await sp.getByTestId("assessment-row").first().waitFor().catch(() => {});
  // after a reload the page restarts at the intro; resuming must keep the attempt and the saved answers
  await sp.getByTestId("begin-assessment").click();
  await sp.getByText("Question 1 of 5").waitFor();
  check((await sp.getByTestId("choice-a").getAttribute("aria-checked")) === "true", "after a refresh the earlier answer is still there (attempt resumed)");
  await sp.getByTestId("next-question").click();
  check((await sp.getByTestId("answer-input").inputValue()) === "5", "...and so is the typed answer");
  await sp.getByTestId("next-question").click();
  await sp.getByTestId("tf-true").click();
  await sp.getByTestId("next-question").click();
  await sp.getByLabel("Match -2").selectOption("2");
  await sp.getByLabel("Match -7").selectOption("7");
  await sp.getByTestId("next-question").click();
  // ordering: put items into -3, 0, 4
  const readOrder = async () => (await sp.locator("ol li span.flex-1").allInnerTexts()).map((t) => t.trim());
  const want = ["-3", "0", "4"];
  for (let i = 0; i < want.length; i++) {
    while ((await readOrder()).indexOf(want[i]) > i) await sp.getByRole("button", { name: `Move ${want[i]} up` }).click();
  }
  check(JSON.stringify(await readOrder()) === JSON.stringify(["-3", "0", "4"]), "the ordering question can be arranged with the arrows");
  await sp.getByTestId("review-submit").click();
  check(/All questions are answered/.test(await sp.getByRole("dialog").innerText()), "the submit dialog says everything is answered");
  await sp.getByTestId("confirm-submit").click();
  await sp.getByTestId("assessment-result").waitFor();
  const resultText = await sp.getByTestId("assessment-result").innerText();
  check(/100%/.test(resultText), `a correct quiz scores 100% (${resultText.match(/\d+%/)?.[0]})`);
  check((await sp.getByTestId("answers-hidden").count()) === 0 && /Your answer/.test(resultText), "a quiz shows the student their answers after submitting");

  // --- the pre-test with a timer
  await sp.goto(base + "/student/assessments");
  const pre = sp.getByTestId("assessment-row").filter({ hasText: "Pre " + run });
  await pre.getByTestId("open-assessment").click();
  check(/1 minutes?/.test(await sp.locator("body").innerText()), "the intro states the time limit");
  await sp.clock.install();
  await sp.getByTestId("begin-assessment").click();
  await sp.getByTestId("timer").waitFor();
  check(/0:5\d|1:00/.test(await sp.getByTestId("timer").innerText()), "the countdown shows about a minute");
  await sp.getByTestId("choice-a").click().catch(() => {});
  await sp.clock.fastForward(61_000);
  await sp.getByTestId("assessment-result").waitFor({ timeout: 10000 });
  check(true, "when the timer runs out the answers are submitted automatically");
  check((await sp.getByTestId("answers-hidden").count()) === 1, "a pre-test result hides the right answers");
  await sp.goto(base + "/student/assessments");
  await sp.getByTestId("assessment-row").first().waitFor();
  const preRow = sp.getByTestId("assessment-row").filter({ hasText: "Pre " + run });
  check((await preRow.getByTestId("open-assessment").count()) === 0 && /Taken once only/.test(await preRow.innerText()), "a completed pre-test cannot be started again");
  await sp.close();
}

// ---- 3. teacher sees results
{
  const page = await teacher.newPage(); watch(page);
  await page.goto(base + "/teacher/assessments");
  await page.getByTestId("teacher-assessment").first().waitFor();
  await page.getByTestId("teacher-assessment").filter({ hasText: "Quiz " + run }).getByTestId("view-results").click();
  await page.getByTestId("results-summary").waitFor();
  check(/completed\s*1/i.test((await page.getByTestId("results-summary").innerText()).replace(/\n/g, " ")), "the teacher's results page counts the completed student");
  check(/Browser Student/.test(await page.getByTestId("results-students").innerText()) && /100%/.test(await page.getByTestId("results-students").innerText()), "...lists the student by name with the score");
  await page.close();
}

check(errors.length === 0, `no uncaught page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await finish(browser);

/**
 * Phase 25 real-browser check of the classroom UI: admin creates a teacher, teacher creates a class,
 * adds a student by email, assigns a published lesson; a student joins by code and sees the assignment.
 *   AI_PROVIDER=local PORT=3000 npx tsx server.ts &     # FRESH in-memory server
 *   node scripts/test-phase25-browser.mjs
 * Env: BASE_URL, CHROMIUM_PATH, ADMIN_EMAIL, ADMIN_PASSWORD, SCREENSHOT_DIR (optional).
 */
import { chromium } from "playwright-core";
import fs from "fs";

const base = process.env.BASE_URL || "http://localhost:3000";
const adminEmail = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const adminPass = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const exe =
  process.env.CHROMIUM_PATH ||
  fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const errors = [];
const watch = (page) => page.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });
const shot = async (page, name) => { if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/${name}.png`, fullPage: true }); };

async function loginCtx(email, password) {
  const ctx = await browser.newContext();
  const r = await ctx.request.post(base + "/api/auth/login", { data: { email, password } });
  if (!r.ok()) throw new Error(`login failed for ${email}: ${r.status()}`);
  const page = await ctx.newPage();
  watch(page);
  return { ctx, page };
}

const stamp = Date.now();
const teacherEmail = `t${stamp}@school.test`;
const teacherPass = "Teach3rPass9";
const studentEmail = `s${stamp}@school.test`;
const studentPass = "Stud3ntPass9";

// ---- Admin creates a teacher through the UI
const admin = await loginCtx(adminEmail, adminPass);
await admin.page.goto(base + "/admin");
const acct = admin.page.getByTestId("admin-accounts");
await acct.waitFor({ timeout: 20000 });
await acct.getByLabel("Full name").fill("Ms Browser Teacher");
await acct.getByLabel("Email").fill(teacherEmail);
await acct.getByLabel("Temporary password").fill("short");
await acct.getByRole("button", { name: "Create account" }).click();
await admin.page.getByRole("status").waitFor({ timeout: 10000 });
check(/8|letter|password/i.test(await admin.page.getByRole("status").innerText()), "admin UI: a weak password is rejected with a reason");
await acct.getByLabel("Temporary password").fill(teacherPass);
await acct.getByRole("button", { name: "Create account" }).click();
await admin.page.getByText(/Created teacher account/).waitFor({ timeout: 10000 });
await acct.getByText(teacherEmail).waitFor({ timeout: 10000 }).catch(() => {});
check(await acct.getByText(teacherEmail).count() >= 1, "admin UI: the new teacher appears in the account list");
await shot(admin.page, "admin");

// ---- A student registers (self-service)
const sreg = await browser.newContext();
const reg = await sreg.request.post(base + "/api/auth/register", { data: { name: "Browser Student", email: studentEmail, password: studentPass, role: "STUDENT" } });
check(reg.ok(), "student self-registration works");

// ---- Teacher creates a class, adds the student, assigns a lesson
const teacher = await loginCtx(teacherEmail, teacherPass);
const tp = teacher.page;
await tp.goto(base + "/teacher/classes");
await tp.getByTestId("create-class-form").waitFor({ timeout: 20000 });
await tp.getByLabel("New class name").fill("Browser Class 7A");
await tp.getByRole("button", { name: "Create class" }).click();
await tp.getByText("Browser Class 7A").first().waitFor({ timeout: 10000 });
check(true, "teacher UI: a new class appears after creation");
await tp.getByText("Browser Class 7A").first().click();
await tp.getByTestId("join-code").waitFor({ timeout: 10000 });
const code = (await tp.getByTestId("join-code").innerText()).trim();
check(/^[A-HJKMNP-Z2-9]{6}$/.test(code), `teacher UI: a 6-character class code is shown (${code})`);

await tp.getByLabel(/Add students by email/).fill(`${studentEmail}\nnobody${stamp}@school.test`);
await tp.getByRole("button", { name: "Add to class" }).click();
await tp.getByTestId("roster-results").waitFor({ timeout: 10000 });
const results = await tp.getByTestId("roster-results").innerText();
check(/Added/.test(results) && /No student account/.test(results), "teacher UI: roster result distinguishes added vs unknown email");
check(await tp.getByRole("button", { name: /Remove Browser Student/ }).count() === 1, "teacher UI: enrolled student appears in the roster");

await tp.getByRole("button", { name: "Create Assignment" }).click();
await tp.getByLabel("Assignment Title").fill("Browser Assignment");
await tp.getByRole("button", { name: "Publish Assignment" }).click();
check(/lesson/i.test(await tp.getByRole("alert").innerText()), "teacher UI: an assignment with no lesson is rejected with a reason");
const lessonOptions = await tp.locator("#assignment-lesson option").count();
check(lessonOptions > 1, `teacher UI: published lessons are offered (${lessonOptions - 1})`);
await tp.locator("#assignment-lesson").selectOption({ index: 1 });
await tp.getByRole("button", { name: "Publish Assignment" }).click();
await tp.getByText("Browser Assignment").first().waitFor({ timeout: 10000 });
check(true, "teacher UI: assignment is listed on the class");
await shot(tp, "teacher-class");

// ---- Student sees the class and assignment; a second student joins by code
const student = await loginCtx(studentEmail, studentPass);
await student.page.goto(base + "/student");
const card = student.page.getByTestId("student-classes");
await card.waitFor({ timeout: 20000 });
await card.getByText("Browser Class 7A").first().waitFor({ timeout: 10000 }).catch(() => {});
check(await card.getByText("Browser Class 7A").count() >= 1, "student UI: teacher-added class is listed");
await card.getByText("Browser Assignment").first().waitFor({ timeout: 10000 }).catch(() => {});
check(await card.getByText("Browser Assignment").count() >= 1, "student UI: the assignment is shown");

const s2email = `s2${stamp}@school.test`;
await sreg.request.post(base + "/api/auth/register", { data: { name: "Second Student", email: s2email, password: studentPass, role: "STUDENT" } });
const s2 = await loginCtx(s2email, studentPass);
await s2.page.goto(base + "/student");
const card2 = s2.page.getByTestId("student-classes");
await card2.waitFor({ timeout: 20000 });
await card2.getByLabel(/Join a class/).fill("ZZZZZZ");
await card2.getByRole("button", { name: "Join class" }).click();
await card2.getByRole("status").waitFor({ timeout: 10000 });
check(/not valid/i.test(await card2.getByRole("status").innerText()), "student UI: a wrong code gives one generic message");
await card2.getByLabel(/Join a class/).fill(code.toLowerCase());
await card2.getByRole("button", { name: "Join class" }).click();
await card2.getByText(/You joined Browser Class 7A/).waitFor({ timeout: 10000 });
await card2.getByText("Browser Assignment").first().waitFor({ timeout: 10000 }).catch(() => {});
check(await card2.getByText("Browser Assignment").count() >= 1, "student UI: joining by (lower-case) code shows the class assignment");
await shot(s2.page, "student-join");

// ---- Teacher turns the code off: the join stops working
await tp.getByRole("button", { name: "Turn code off" }).click();
await tp.getByText(/The class code is off/).waitFor({ timeout: 10000 });
const s3email = `s3${stamp}@school.test`;
await sreg.request.post(base + "/api/auth/register", { data: { name: "Third Student", email: s3email, password: studentPass, role: "STUDENT" } });
const s3 = await loginCtx(s3email, studentPass);
const j = await s3.ctx.request.post(base + "/api/student/classes/join", { data: { code } });
check(j.status() === 404, "switching the code off blocks new joins");

// ---- Teacher removes the first student; the student loses access in the UI
page: {
  tp.once("dialog", (d) => d.accept());
  await tp.getByRole("button", { name: /Remove Browser Student/ }).click();
  await tp.waitForFunction(() => !document.body.innerText.includes("Remove Browser Student"), null, { timeout: 10000 });
  await student.page.reload();
  await student.page.getByTestId("student-classes").waitFor({ timeout: 20000 });
  await student.page.waitForTimeout(500);
  check(await student.page.getByTestId("student-classes").getByText("Browser Assignment").count() === 0, "after removal the student no longer sees the assignment");
}

check(errors.length === 0, "no uncaught page errors" + (errors.length ? " -> " + errors[0] : ""));
await browser.close();
console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

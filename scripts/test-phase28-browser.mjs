/**
 * Phase 28 real-browser check: a student cannot finish the seeded lesson until its questions are answered correctly.
 *   AI_PROVIDER=local PORT=3000 npx tsx server.ts &     # FRESH in-memory server
 *   node scripts/test-phase28-browser.mjs
 */
import { chromium } from "playwright-core";
import fs from "fs";

const base = process.env.BASE_URL || "http://localhost:3000";
const exe =
  process.env.CHROMIUM_PATH ||
  fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };

const ctx = await browser.newContext();
const reg = await ctx.request.post(base + "/api/auth/register", { data: { name: "Browser Finisher", email: `f${Date.now()}@school.test`, password: "Stud3ntPass9" } });
check(reg.ok(), "student registered");
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });

await page.goto(base + "/student/lessons/lsn_01");
await page.getByRole("button", { name: /Next Section/ }).first().waitFor({ timeout: 20000 });
// Skip straight through every section without answering anything
for (let i = 0; i < 30 && (await page.getByRole("button", { name: /Complete Lesson/ }).count()) === 0; i++) {
  await page.getByRole("button", { name: /Next Section/ }).click();
  await page.waitForTimeout(150);
}
await page.getByRole("button", { name: /Complete Lesson/ }).click();
const alert = page.getByRole("alert").filter({ hasText: /remaining question/ });
await alert.waitFor({ timeout: 10000 });
check(true, "finishing without answering is refused with a message: \"" + (await alert.innerText()).trim() + "\"");
check((await page.getByText("Submit Answer").count()) >= 1, "the student is taken back to a question that still needs answering");

// Answer every question that appears, by trying the choices (what a student would do)
async function answerCurrent() {
  const n = await page.locator("input[type=radio]").count();
  for (let i = 0; i < n; i++) {
    await page.locator("label:has(input[type=radio])").nth(i).click();
    await page.waitForTimeout(100);
    await page.getByRole("button", { name: "Submit Answer" }).click();
    const ok = await page.getByText(/^Correct!/).first().waitFor({ timeout: 4000 }).then(() => true).catch(() => false);
    if (ok) return true;
    await page.getByRole("button", { name: /Try Again/ }).click();
  }
  return false;
}
let answered = 0;
const completed = async () => (await (await ctx.request.get(base + "/api/student/learning-path")).json()).data.learningPath.find((n) => n.lessonId === "lsn_01").state === "COMPLETED";
for (let step = 0; step < 40 && !(await completed()); step++) {
  if ((await page.getByText("Submit Answer").count()) > 0 && (await page.locator("input[type=radio]:disabled").count()) === 0) { if (await answerCurrent()) answered++; }
  const finish = page.getByRole("button", { name: /Complete Lesson|Finish & Return/ });
  if ((await finish.count()) > 0) { await finish.click(); await page.waitForTimeout(500); }
  else await page.getByRole("button", { name: /Next Section/ }).click();
  await page.waitForTimeout(150);
}
check(answered >= 1, `answered ${answered} question(s) correctly through the UI`);
const path = await (await ctx.request.get(base + "/api/student/learning-path")).json();
check(path.data.learningPath.find((n) => n.lessonId === "lsn_01").state === "COMPLETED", "once every question is answered correctly the lesson is COMPLETED on the server");
check(errors.length === 0, "no uncaught page errors" + (errors.length ? " -> " + errors[0] : ""));
await browser.close();
console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

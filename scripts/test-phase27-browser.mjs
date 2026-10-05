/**
 * Phase 27 real-browser check: a student answers the seeded checkpoint in the real lesson page.
 *   AI_PROVIDER=local PORT=3000 npx tsx server.ts &     # FRESH in-memory server
 *   node scripts/test-phase27-browser.mjs
 * Env: BASE_URL, CHROMIUM_PATH, SCREENSHOT_DIR (optional).
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

const stamp = Date.now();
const ctx = await browser.newContext();
const reg = await ctx.request.post(base + "/api/auth/register", { data: { name: "Browser Grader", email: `g${stamp}@school.test`, password: "Stud3ntPass9" } });
check(reg.ok(), "student registered");
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });
const bodies = [];
page.on("response", async (r) => {
  if (r.url().includes("/api/") && !r.url().includes("/api/auth")) { try { bodies.push({ url: r.url(), text: await r.text() }); } catch { /* ignore */ } }
});
const posts = [];
page.on("request", (r) => { if (r.method() === "POST" && r.url().endsWith("/checkpoint")) posts.push(r.postData()); });

await page.goto(base + "/student/lessons/lsn_01");
await page.getByRole("button", { name: /Next Section/ }).first().waitFor({ timeout: 20000 });
for (let i = 0; i < 12 && (await page.getByText("Submit Answer").count()) === 0; i++) {
  await page.getByRole("button", { name: /Next Section/ }).click();
  await page.waitForTimeout(250);
}
await page.getByText("Submit Answer").waitFor({ timeout: 10000 });
check(true, "reached the checkpoint section");

const lessonBodies = bodies.filter((b) => /\/api\/lessons\/lsn_01$/.test(b.url));
check(lessonBodies.length >= 1 && lessonBodies.every((b) => !/correctAnswer/.test(b.text)), "the lesson payload the browser received contains no correctAnswer");
check(bodies.every((b) => !/correctAnswer/.test(b.text)), "no API response seen so far contains an answer key");
check((await page.locator("input[type=radio]").count()) === 3, "three answer choices are shown");

// Wrong answer first
await page.locator("label", { hasText: "-5" }).first().click();
await page.getByRole("button", { name: "Submit Answer" }).click();
await page.getByText(/Not quite/).waitFor({ timeout: 10000 });
check(true, "a wrong answer is reported as not correct");
check((await page.locator("label.border-emerald-500").count()) === 0, "the correct option is NOT highlighted after a wrong answer");
check((await page.locator("label.border-red-400").count()) === 1, "only the chosen (wrong) option is marked");
check(posts.length === 1 && !/isCorrect/.test(posts[0]), "the browser sends only {blockId, answer}: it does not send a correctness claim");
await page.getByRole("button", { name: /Try Again/ }).click();

// Then the right answer
await page.locator("label", { hasText: "-2" }).first().click();
await page.getByRole("button", { name: "Submit Answer" }).click();
await page.getByText(/Correct! Excellent reasoning/).waitFor({ timeout: 10000 });
check((await page.locator("label.border-emerald-500").count()) === 1, "after the right answer the correct option is highlighted");
if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/checkpoint.png`, fullPage: true });

// Reload: history is restored from the server's graded attempt
await page.reload();
await page.getByRole("button", { name: /Next Section/ }).first().waitFor({ timeout: 20000 });
const s = await ctx.request.get(base + "/api/student/lessons/lsn_01/session");
const attempts = (await s.json()).data.attempts;
check(attempts.length === 2 && attempts.some((a) => a.isCorrect) && attempts.some((a) => !a.isCorrect), "the server stored one wrong and one correct attempt");
check(errors.length === 0, "no uncaught page errors" + (errors.length ? " -> " + errors[0] : ""));
await browser.close();
console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

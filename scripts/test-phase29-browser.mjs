/**
 * Phase 29 real-browser check of the teacher Research Analytics page (demo teacher, in-memory server).
 *   AI_PROVIDER=local PORT=3000 npx tsx server.ts &     # FRESH in-memory server
 *   node scripts/test-phase29-browser.mjs
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

const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const login = await ctx.request.post(base + "/api/auth/login", { data: { email: "teacher@tuklas.ai", password: "Tuklas2026!" } });
check(login.ok(), "teacher signed in");
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });
const calls = [];
page.on("request", (r) => { if (r.url().includes("/api/teacher/research/")) calls.push(r.url()); });

await page.goto(base + "/teacher/research");
await page.getByText(/Research/i).first().waitFor({ timeout: 20000 });
await page.waitForTimeout(2500);
const text = await page.evaluate(() => document.body.innerText);
check(!/Section Mabini|cls_mabini|Primary Sample/.test(text), "no hard-coded demo class or student is shown");
const classOptions = await page.locator("select").first().locator("option").allInnerTexts();
check(classOptions[0] === "All my students" && classOptions.some((o) => /Section Rizal/.test(o)), `the class list is the teacher's own classes: ${classOptions.join(" | ")}`);
const studentOptions = await page.locator("select").nth(2).locator("option").allInnerTexts();
check(studentOptions.length > 1 && studentOptions[0] === "Choose a student...", `the student list is the teacher's real students (${studentOptions.length - 1})`);
check(!(await page.getByText("+23.0 pts").count()), "the invented +23.0 point improvement is gone");
check(/No data|Not enough data|not evidence of cause/.test(text), "pre/post shows either 'No data' or a real comparison that says it is not evidence of cause");
check(!/Relative growth: \+/.test(text) && !(await page.getByText(/^\+23\.0 pts$/).count()), "no hard-coded 'Relative growth' / +23.0 wording");
const neg = await page.locator("td.text-rose-600").count();
check(!/-\d+(\.\d)? pts/.test(text) || neg >= 1, "a negative skill change is not coloured as an improvement");
check(calls.every((u) => !/profile\/usr_student_01/.test(u)), "the page does not request a hard-coded student profile");
if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/research.png`, fullPage: true });

// Choose a class, then a student: the page requests that scope
await page.locator("select").first().selectOption({ index: 1 });
await page.waitForTimeout(1500);
check(calls.some((u) => /classroomId=/.test(u)), "choosing a class scopes every research request to it");
await page.locator("select").nth(2).selectOption({ index: 1 }).catch(() => {});
await page.waitForTimeout(1500);
check(errors.length === 0, "no uncaught page errors" + (errors.length ? " -> " + errors[0] : ""));
await browser.close();
console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

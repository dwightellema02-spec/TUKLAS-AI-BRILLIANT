/**
 * Phase 38 browser check against a server on a database seeded with the real Term 1 curriculum (run by test-phase38-prisma.ts).
 * A student on a phone walks Week 1 through the real screens; a teacher looks at the curriculum screens.
 * Env: BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD.
 */
import { chromium } from "playwright-core";
import fs from "fs";
import crypto from "crypto";

const base = process.env.BASE_URL;
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find((p) => fs.existsSync(p));
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const j = async (m, p, t, b) => (await fetch(base + p, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined })).json();
const run = crypto.randomBytes(3).toString("hex");
const admin = (await j("POST", "/api/auth/login", null, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).token;
await j("POST", "/api/admin/users", admin, { name: "Teach", email: `bt.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER" });
const T = (await j("POST", "/api/auth/login", null, { email: `bt.${run}@example.edu`, password: "Sturdy-Pass1" })).token;
const S = (await j("POST", "/api/auth/register", null, { name: "Walk", email: `bs.${run}@example.edu`, password: "Sturdy-Pass1" })).token;
const lessons = (await j("GET", "/api/lessons", S)).data;
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const watch = (p, bag) => {
  p.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) bag.push(`pageerror ${e.message}`); });
  p.on("console", (m) => { if (m.type() === "error" && !/WebSocket|favicon|Failed to load resource/i.test(m.text())) bag.push(`console ${m.text().slice(0, 160)}`); });
};

// ---- student, phone
const sErr = [];
const sctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
await sctx.addCookies([{ name: "tuklas_session", value: S, url: base }]);
const sp = await sctx.newPage(); watch(sp, sErr);
// the three daily lessons that carry a diagram (Phase 49 split the weekly lessons into daily ones)
const withDiagrams = [/Week 2, Day 1:/, /Week 2, Day 3:/, /Week 3, Day 1:/].map((re) => lessons.find((l) => re.test(l.title)));
let images = 0, brokenImages = 0, mathErrors = 0, overflow = 0, katex = 0;
for (const lesson of withDiagrams) {
  await sp.goto(`${base}/student/lessons/${lesson.id}`); await sp.waitForTimeout(2500);
  for (let i = 0; i < 14; i++) {
    const info = await sp.evaluate(() => ({
      imgs: [...document.images].filter((x) => x.src.startsWith("data:")).map((x) => x.naturalWidth),
      kerr: document.querySelectorAll(".katex-error").length, k: document.querySelectorAll(".katex").length,
      over: document.documentElement.scrollWidth > window.innerWidth + 1,
    }));
    images += info.imgs.length; brokenImages += info.imgs.filter((w) => w === 0).length; mathErrors += info.kerr; katex += info.k; overflow += info.over ? 1 : 0;
    const next = sp.getByRole("button", { name: /Next Section/ }).first();
    if (!(await next.count())) break;
    await next.click(); await sp.waitForTimeout(300);
  }
}
check(images >= 3 && brokenImages === 0, `The daily lessons' diagrams all load (${images} images, ${brokenImages} broken)`);
check(katex > 10 && mathErrors === 0, `Math renders (${katex} formulas, ${mathErrors} errors)`);
check(overflow === 0, "No section scrolls sideways on a 390px phone");
check(sErr.length === 0, `No page errors or React warnings in the lesson (${sErr.join(" | ").slice(0, 300)})`);
// all diagrams, wherever they appear, are valid pictures
await sp.goto(`${base}/student/learning-path`); await sp.waitForTimeout(2500);
const path = await sp.innerText("main");
check(/Term 1 and Term 2/i.test(path) && /Lesson 22/i.test(path) && !/Lesson 1\b[\s\S]*Lesson 1\b/i.test(path), "Learning path names the whole course and numbers the lessons one after another (integers is Lesson 22, not 'Lesson 1')");
check(/Requires completion of/.test(path), "Locked lessons say what unlocks them");

// ---- teacher, laptop
const tErr = [];
const tctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await tctx.addCookies([{ name: "tuklas_session", value: T, url: base }]);
const tp = await tctx.newPage(); watch(tp, tErr);
await tp.goto(`${base}/teacher/curriculum`); await tp.waitForTimeout(2500);
const cur = await tp.innerText("main");
check(/Term 1 · Unit 1/i.test(cur) && /Term 2 · Unit 1/i.test(cur) && /Number and Algebra: Integers/.test(cur), "Teacher curriculum screen lists both terms, including the Term 2 integers unit");
const cdata = (await j("GET", "/api/curriculum", T)).data[0].grades[0].terms;
const intUnit = cdata.flatMap((t) => t.units).find((u) => /Integers/.test(u.title));
await tp.goto(`${base}/teacher/curriculum/${intUnit.id}`); await tp.waitForTimeout(2500);
check(/Understanding Integers/.test(await tp.innerText("main")), "The Term 2 unit page opens that unit's lessons (it used to show Term 1's first unit)");
await tp.goto(`${base}/teacher/practice-sets`); await tp.waitForTimeout(2000);
check(/Practice: Week 6, Day 3/.test(await tp.innerText("main")), "Teacher sees the seeded practice sets");
check(tErr.length === 0, `No page errors in the teacher screens (${tErr.join(" | ").slice(0, 300)})`);
await browser.close();
console.log(failed ? `${failed} CHECK(S) FAILED` : "ALL BROWSER CHECKS PASSED");
process.exit(failed ? 1 : 0);

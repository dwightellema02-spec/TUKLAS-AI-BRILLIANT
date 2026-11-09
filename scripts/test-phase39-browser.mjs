/**
 * Phase 39 browser check: a teacher opens a lesson for the class on the class screen; a student on a phone then sees it open and can enter it.
 *   node scripts/test-phase39-browser.mjs            (spawns its own in-memory dev server)
 *   BASE_URL=http://... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/test-phase39-browser.mjs   (a server you started, e.g. on PostgreSQL)
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

const external = !!process.env.BASE_URL;
const port = 5700 + Math.floor(Math.random() * 90);
const base = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find((p) => fs.existsSync(p));
let srv;
if (!external) srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const finish = async (b) => { try { await b?.close(); } catch { /* */ } try { if (srv) process.kill(-srv.pid, "SIGTERM"); } catch { /* */ } console.log(failed ? `${failed} CHECK(S) FAILED` : "ALL BROWSER CHECKS PASSED"); process.exit(failed ? 1 : 0); };
for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* */ } }
const j = async (m, p, t, b) => (await fetch(base + p, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined })).json();
const run = crypto.randomBytes(3).toString("hex");
const admin = (await j("POST", "/api/auth/login", null, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).token;
await j("POST", "/api/admin/users", admin, { name: "Teach", email: `bt.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER", verifyMathematics: true });
const T = (await j("POST", "/api/auth/login", null, { email: `bt.${run}@example.edu`, password: "Sturdy-Pass1" })).token;
const sreg = await j("POST", "/api/auth/register", null, { name: "Pat Student", email: `bs.${run}@example.edu`, password: "Sturdy-Pass1" });
const S = sreg.token;
const unit = ((await j("GET", "/api/curriculum", T)).data[0].grades[0].terms ?? []).flatMap((t) => t.units)[0];
const mk = async (title) => { const id = (await j("POST", "/api/lessons", T, { title, unitId: unit.id, learningObjectives: ["x"] })).data.id; for (const st of ["REVIEW", "APPROVED", "PUBLISHED"]) await j("POST", `/api/lessons/${id}/status`, T, { targetStatus: st }); return id; };
const L1 = await mk(`BL one ${run}`), L2 = await mk(`BL two ${run}`);
const cls = (await j("POST", "/api/teacher/classes", T, { name: `BC ${run}`, gradeLevel: 7 })).data;
await j("POST", `/api/teacher/classes/${cls.id}/students`, T, { emails: [`bs.${run}@example.edu`] });

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const errs = [];
const watch = (p, who) => { p.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errs.push(`${who}: ${e.message}`); }); p.on("console", (m) => { if (m.type() === "error" && !/WebSocket|favicon|Failed to load resource/i.test(m.text())) errs.push(`${who}: ${m.text().slice(0, 140)}`); }); };

// student first: L2 is locked
const sctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
await sctx.addCookies([{ name: "tuklas_session", value: S, url: base }]);
const sp = await sctx.newPage(); watch(sp, "student");
const pathText = async () => { await sp.goto(`${base}/student/learning-path`); await sp.waitForTimeout(2200); return sp.innerText("main"); };
// the roadmap card of the lesson: found through its heading (other cards may mention the lesson in a lock reason)
const card = async () => sp.locator("h3", { hasText: `BL two ${run}` }).first().locator("xpath=../../..").innerText();
let t = await pathText();
check(/Locked/.test(await card()) && !/Opened by your teacher/.test(t), "Before: the second lesson shows as locked");

// teacher opens it on the class screen
const tctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await tctx.addCookies([{ name: "tuklas_session", value: T, url: base }]);
const tp = await tctx.newPage(); watch(tp, "teacher");
await tp.goto(`${base}/teacher/classes/${cls.id}`); await tp.waitForTimeout(2500);
const panel = tp.getByTestId("lesson-access");
check(await panel.count() === 1 && /Lesson access/.test(await panel.innerText()), "The class screen has a Lesson access panel");
const row = panel.locator("li", { hasText: `BL two ${run}` });
check(await row.count() === 1, "The panel lists the lesson");
await row.getByRole("button", { name: /^Open lesson \d+$/ }).click(); await tp.waitForTimeout(1200);
check(/Opened/.test(await row.innerText()), "After clicking, the row says Opened");
// reload to prove it was saved, not just shown
await tp.reload(); await tp.waitForTimeout(2200);
check(/Opened/.test(await tp.getByTestId("lesson-access").locator("li", { hasText: `BL two ${run}` }).innerText()), "It is still open after reloading the page");

t = await pathText();
if (process.env.DEBUG39) { console.log(JSON.stringify((await j("GET", "/api/student/learning-path", S)).data.learningPath.map((n) => [n.title, n.state, n.openedByTeacher]))); console.log(await card()); }
check(/Opened by your teacher/.test(await card()) && !/Locked/.test(await card()), "The student now sees 'Opened by your teacher' on that lesson");
await sp.goto(`${base}/student/lessons/${L2}`); await sp.waitForTimeout(2500);
const body = await sp.innerText("body");
if (process.env.DEBUG39) console.log(body.slice(0, 500));
check(body.includes(`BL two ${run}`) && !/requires completion|is locked|complete the required/i.test(body), "The student can enter the lesson (no lock message)");

// per-student scope + close
await tp.getByLabel("Open for").selectOption({ label: "Pat Student" }); await tp.waitForTimeout(500);
const l1 = tp.getByTestId("lesson-access").locator("li", { hasText: `BL one ${run}` });
check(!/Opened/.test(await l1.innerText()), "Choosing one student shows that student's own openings");
await tp.getByLabel("Open for").selectOption(""); await tp.waitForTimeout(300);
await tp.getByTestId("lesson-access").locator("li", { hasText: `BL two ${run}` }).getByRole("button", { name: /^Close lesson \d+$/ }).click(); await tp.waitForTimeout(1000);
check(!/Opened/.test(await tp.getByTestId("lesson-access").locator("li", { hasText: `BL two ${run}` }).innerText()), "The teacher can close it again");

// phone width for the teacher panel
await tp.setViewportSize({ width: 390, height: 800 }); await tp.waitForTimeout(500);
check(!(await tp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), "The class screen does not scroll sideways on a phone");
check(errs.length === 0, `No page errors (${errs.join(" | ").slice(0, 250)})`);
await finish(browser);

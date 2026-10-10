/**
 * Phase 47 browser checks.
 *  1. "The server is waking up": the app shows a notice, retries by itself, and does NOT sign the person out when the server answers 503 for a while.
 *  2. A phone-sized pass over the student, teacher and admin screens: no sideways scrolling, no errors, and a list of small tap targets.
 *   node scripts/test-phase47-browser.mjs      (spawns its own in-memory dev server)    |    BASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=...
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

const external = !!process.env.BASE_URL;
const port = 6000 + Math.floor(Math.random() * 90);
const base = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find((p) => fs.existsSync(p));
const shots = process.env.SCREENSHOT_DIR; if (shots) fs.mkdirSync(shots, { recursive: true });
let srv;
if (!external) {
  try { fs.rmSync("data/users-persistence.json", { force: true }); } catch { /* */ }
  srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), DATABASE_URL: "" }, stdio: "ignore", detached: true });
}
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const finish = async (browser) => { try { await browser?.close(); } catch { /* */ } try { if (srv) process.kill(-srv.pid, "SIGTERM"); } catch { /* */ } console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} BROWSER CHECK(S) FAILED`); process.exit(failed === 0 ? 0 : 1); };
for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* waiting */ } }
const j = async (m, p, t, b) => { const r = await fetch(base + p, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined }); return r.json().catch(() => ({})); };
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai", ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
try {
  const admin = (await j("POST", "/api/auth/login", null, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).token;
  const run = crypto.randomBytes(3).toString("hex");
  await j("POST", "/api/admin/users", admin, { name: "Teacher Cruz", email: `t47.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER" });
  const T = (await j("POST", "/api/auth/login", null, { email: `t47.${run}@example.edu`, password: "Sturdy-Pass1" })).token;
  const S = (await j("POST", "/api/auth/register", null, { name: "Pupil Santos", email: `s47.${run}@example.edu`, password: "Sturdy-Pass1" })).token;

  // ---------- 1. the server is waking up ----------
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addCookies([{ name: "tuklas_session", value: S, url: base }]);
  const page = await ctx.newPage();
  let meCalls = 0, skillCalls = 0;
  await page.route("**/api/auth/me", async (route) => { meCalls++; if (meCalls <= 2) return route.fulfill({ status: 503, contentType: "application/json", headers: { "Retry-After": "5" }, body: JSON.stringify({ error: "The database is not reachable right now.", code: "DATABASE_UNAVAILABLE" }) }); return route.continue(); });
  await page.route("**/api/student/learning-path", async (route) => { skillCalls++; if (skillCalls <= 1) return route.abort("connectionrefused"); return route.continue(); });
  await page.goto(base + "/student/learning-path");
  await page.getByTestId("connection-notice").waitFor({ timeout: 10000 });
  check(/waking up or reconnecting/.test(await page.getByTestId("connection-notice").innerText()), "While the server answers 503 the page shows a 'waking up' notice");
  await page.getByTestId("connection-notice").waitFor({ state: "detached", timeout: 30000 });
  check(meCalls >= 3, `The app tried again by itself until the server answered (${meCalls} calls to /api/auth/me)`);
  check((await page.getByRole("button", { name: /Sign In/ }).count()) === 0 || (await page.getByText("Pupil Santos").count()) > 0 || (await page.getByRole("button", { name: /Sign Out/ }).count()) > 0, "The student was NOT shown the sign-in screen: still signed in after the outage");
  check(skillCalls >= 2, "A request that failed with a connection error (a read) was repeated and the page loaded");
  check((await page.locator("body").innerText()).length > 200, "The learning path is on screen after recovery");

  // ---------- 2. phone-sized pass ----------
  const pages = [
    ["student", S, ["/", "/student", "/student/learning-path", "/student/practice-history", "/student/assessments", "/account", "/privacy"]],
    ["teacher", T, ["/teacher", "/teacher/curriculum", "/teacher/lessons", "/teacher/lessons/new", "/teacher/question-bank", "/teacher/practice-sets", "/teacher/students", "/teacher/classes", "/teacher/assessments", "/teacher/research", "/teacher/ai-settings"]],
    ["admin", admin, ["/admin"]],
  ];
  const small = new Map();
  for (const [who, tok, paths] of pages) {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await c.addCookies([{ name: "tuklas_session", value: tok, url: base }]);
    const p = await c.newPage();
    const errs = [];
    p.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errs.push(e.message.slice(0, 120)); });
    p.on("console", (m) => { if (m.type() === "error" && !/WebSocket|favicon|Failed to load resource/i.test(m.text())) errs.push(m.text().slice(0, 120)); });
    for (const path of paths) {
      errs.length = 0;
      await p.goto(base + path, { waitUntil: "networkidle" }).catch(() => {});
      await p.waitForTimeout(400);
      const m = await p.evaluate(() => {
        const vw = 390;
        const wide = [...document.querySelectorAll("body *")].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== "fixed"; }).slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
        const tiny = [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button]")].filter((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && (r.height < 28 || r.width < 28) && !(el.tagName === "A" && el.closest("p, li, span") && el.textContent.trim().split(" ").length > 3); }).slice(0, 5).map((el) => `${el.tagName.toLowerCase()}:${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 25)}`);
        return { scrollW: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth), vw, wide, tiny, hasText: document.body.innerText.length };
      });
      const ok = m.scrollW <= m.vw + 1 && errs.length === 0 && m.hasText > 50;
      check(ok, `${who} ${path}: no sideways scroll (${m.scrollW}/${m.vw}), no errors${m.wide.length ? " WIDE: " + m.wide.join(" ") : ""}${errs.length ? " ERR: " + errs[0] : ""}`);
      if (m.tiny.length) small.set(`${who} ${path}`, m.tiny);
      if (shots) await p.screenshot({ path: `${shots}/${who}${path.replace(/\//g, "_") || "_home"}.png`, fullPage: false });
    }
    await c.close();
  }
  if (small.size) { console.log("\nSmall tap targets (under 28 px; for information, not a failure):"); for (const [k, v] of small) console.log("  " + k + ": " + v.join(", ")); }
} catch (e) { failed++; console.log("FAIL crashed: " + (e?.message ?? e)); }
await finish(browser);

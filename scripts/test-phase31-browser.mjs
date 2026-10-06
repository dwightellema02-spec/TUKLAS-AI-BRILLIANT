/**
 * Phase 31 real-browser check against the PRODUCTION build (spawns its own demo-mode production server):
 * the Content-Security-Policy blocks injected scripts, the real pages run with zero CSP violations, and a student can
 * still do a practice question now that answer keys are removed from what the browser receives.
 *   npm run build && node scripts/test-phase31-browser.mjs
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

const port = 4500 + Math.floor(Math.random() * 90);
const base = `http://127.0.0.1:${port}`;
const exe =
  process.env.CHROMIUM_PATH ||
  fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
const srv = spawn("npx", ["tsx", "server.ts"], {
  env: { ...process.env, PORT: String(port), NODE_ENV: "production", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), ALLOW_DEMO_MODE: "I_UNDERSTAND_DEMO_ACCOUNTS_ARE_PUBLIC", DATABASE_URL: "" },
  stdio: "ignore", detached: true,
});
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const finish = async (browser) => {
  try { await browser?.close(); } catch { /* */ }
  try { process.kill(-srv.pid, "SIGTERM"); } catch { /* */ }
  console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
};
for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* waiting */ } }

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const violations = [];
const errors = [];
async function newPage(ctx) {
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  p.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });
  return p;
}
const collect = async (p, label) => { for (const v of await p.evaluate(() => window.__csp || [])) violations.push(`${label}: ${v}`); };
const login = async (email) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const r = await ctx.request.post(base + "/api/auth/login", { data: { email, password: "Tuklas2026!" } });
  if (!r.ok()) throw new Error("login failed " + email);
  return ctx;
};

// ---- the policy is real and enforced
const anon = await browser.newContext();
const home = await newPage(anon);
const resp = await home.goto(base + "/");
const csp = resp.headers()["content-security-policy"] ?? "";
check(/script-src 'self'/.test(csp), "the production page is served with a script-src 'self' policy");
await home.waitForTimeout(1500);
check((await home.locator("h1").count()) > 0, "the app still renders under the policy");
await home.evaluate(() => { const s = document.createElement("script"); s.textContent = "window.__pwned = true"; document.body.appendChild(s); });
await home.waitForTimeout(300);
check((await home.evaluate(() => window.__pwned === true)) === false, "an injected inline <script> does NOT run");
await home.evaluate(() => { const i = document.createElement("img"); i.src = "x:bad"; i.setAttribute("onerror", "window.__pwned2 = true"); document.body.appendChild(i); });
await home.waitForTimeout(300);
check((await home.evaluate(() => window.__pwned2 === true)) === false, "an injected inline event handler does NOT run");
check((await home.evaluate(() => window.__csp.length)) >= 1, "the browser reported the blocked attempts as policy violations");
await home.evaluate(() => { window.__csp = []; });
await home.reload(); await home.waitForTimeout(1500);
await collect(home, "home");

// ---- the real pages produce no violations
const sctx = await login("student@tuklas.ai");
const sp = await newPage(sctx);
for (const path of ["/student", "/student/learning-path", "/student/lessons/lsn_01", "/account"]) {
  await sp.goto(base + path); await sp.waitForTimeout(2200); await collect(sp, path);
}
const tctx = await login("teacher@tuklas.ai");
const tp = await newPage(tctx);
for (const path of ["/teacher", "/teacher/classes", "/teacher/research", "/teacher/lessons", "/teacher/question-bank"]) {
  await tp.goto(base + path); await tp.waitForTimeout(2200); await collect(tp, path);
}
const actx = await login("admin@tuklas.ai");
const ap = await newPage(actx);
await ap.goto(base + "/admin"); await ap.waitForTimeout(2200); await collect(ap, "/admin");
check(violations.length === 0, `student, teacher and admin pages run with no CSP violations${violations.length ? " -> " + violations.slice(0, 3).join(" | ") : ""}`);

// ---- a student can still practise with the answer keys stripped
// (plain fetch with the token: the API request context would not send a Secure cookie over plain http)
const tok = (await (await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "student@tuklas.ai", password: "Tuklas2026!" }) })).json()).token;
const start = await (await fetch(base + "/api/practice/start", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` }, body: JSON.stringify({ practiceSetId: "ps_integers_basics" }) })).json();
const sid = start.data?.id;
check(!!sid && !/correctAnswer"|acceptableAnswers/.test(JSON.stringify(start)), "starting a practice session returns no answer keys");
await sp.goto(base + "/student/practice/ps_integers_basics"); // the page takes a practice-SET id and starts its own session
await sp.waitForTimeout(2500);
const bodyText = await sp.evaluate(() => document.body.innerText);
check(/integer/i.test(bodyText), "the practice page shows the question prompt");
// Multiple choice is drawn as lettered buttons (A, B, C, D) between "Exit Practice" and "Need a hint?"
const choiceButtons = sp.locator("main button").filter({ hasNotText: /Exit Practice|Need a hint|Submit Answer/ });
const choices = await choiceButtons.count();
check(choices >= 2, `the answer choices are shown (${choices})`);
await choiceButtons.first().click();
const submit = sp.getByRole("button", { name: /submit|check answer|check/i }).first();
await submit.click();
await sp.waitForTimeout(1500);
const after = await sp.evaluate(() => document.body.innerText);
check(/correct|incorrect|not quite|try again|explanation|feedback|attempt/i.test(after), "submitting an answer returns server feedback in the page");
await collect(sp, "practice");
check(violations.length === 0, "the practice page also ran with no CSP violations");
check(errors.length === 0, "no uncaught page errors" + (errors.length ? " -> " + errors[0] : ""));
await finish(browser);

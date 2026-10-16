/**
 * Phase 48 browser check against the Vercel build (the function bundle behind scripts/serverless-shim.mjs, with vercel.json's headers on the page):
 * the web app loads and works under the real Content-Security-Policy, with no policy violations and no script errors, at phone size.
 *   BASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/test-phase48-browser.mjs
 */
import { chromium } from "playwright-core";
import crypto from "crypto";
import fs from "fs";

const base = process.env.BASE_URL;
if (!base) { console.error("BASE_URL is required (this check runs against an already started serverless shim)."); process.exit(2); }
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`).find((p) => fs.existsSync(p));
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const j = async (m, p, t, b) => { const r = await fetch(base + p, { method: m, headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b ? JSON.stringify(b) : undefined }); return r.json().catch(() => ({})); };
const run = crypto.randomBytes(3).toString("hex");
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
try {
  const admin = (await j("POST", "/api/auth/login", null, { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })).token;
  await j("POST", "/api/auth/accept-privacy", admin);
  await j("POST", "/api/admin/users", admin, { name: "Teacher Cruz", email: `t48.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER" });
  const T = (await j("POST", "/api/auth/login", null, { email: `t48.${run}@example.edu`, password: "Sturdy-Pass1" })).token;
  await j("POST", "/api/auth/accept-privacy", T);
  const S = (await j("POST", "/api/auth/register", null, { name: "Pupil Santos", email: `s48.${run}@example.edu`, password: "Sturdy-Pass1", acceptPrivacy: true })).token;

  for (const [who, token, urls] of [["student", S, ["/student/learning-path", "/student/dashboard"]], ["teacher", T, ["/teacher/lessons/new", "/teacher/curriculum"]]]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addCookies([{ name: "tuklas_session", value: token, url: base }]);
    const page = await ctx.newPage();
    const problems = [];
    page.on("pageerror", (e) => problems.push(`script error: ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" || /Content.Security.Policy/i.test(m.text())) problems.push(`console: ${m.text().slice(0, 200)}`); });
    for (const u of urls) {
      await page.goto(base + u, { waitUntil: "networkidle" });
      const text = await page.locator("body").innerText();
      check(text.length > 150 && !/Something went wrong/i.test(text), `${who}: ${u} shows content (${text.length} characters)`);
      check((await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)), `${who}: ${u} has no sideways scrolling at phone size`);
    }
    check(problems.length === 0, `${who}: no script errors or Content-Security-Policy violations (${problems.slice(0, 2).join(" | ") || "none"})`);
    await ctx.close();
  }
  const head = await fetch(base + "/");
  check(/default-src 'self'/.test(head.headers.get("content-security-policy") ?? "") && !!head.headers.get("strict-transport-security") && head.headers.get("x-frame-options") === "DENY", "The page itself carries the policy, HSTS and no-framing headers from vercel.json");
} catch (e) { failed++; console.log("FAIL crashed: " + (e?.stack || e)); }
await browser.close();
console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} BROWSER CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

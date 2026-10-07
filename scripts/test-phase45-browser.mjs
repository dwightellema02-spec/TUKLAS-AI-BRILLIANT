/**
 * Phase 45 browser journey: a teacher starts a lesson from a Word document on the real page, reads what was imported and what was left out,
 * opens the draft in the studio, and a student cannot see it. Also a scanned PDF is refused with the reason.
 *   node scripts/test-phase45-browser.mjs       (spawns its own in-memory dev server)   |   BASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... (an existing server)
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const external = !!process.env.BASE_URL;
const port = 5800 + Math.floor(Math.random() * 90);
const base = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai", ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
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
const run = crypto.randomBytes(3).toString("hex");
const P45 = path.join(process.cwd(), "scripts", "fixtures", "phase45"), P22 = path.join(process.cwd(), "scripts", "fixtures", "phase22");
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const errs = [];
try {
  const admin = (await j("POST", "/api/auth/login", null, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD })).token;
  await j("POST", "/api/admin/users", admin, { name: "Teacher Reyes", email: `t45.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER" });
  const T = (await j("POST", "/api/auth/login", null, { email: `t45.${run}@example.edu`, password: "Sturdy-Pass1" })).token;
  const S = (await j("POST", "/api/auth/register", null, { name: "Pupil", email: `s45.${run}@example.edu`, password: "Sturdy-Pass1" })).token;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addCookies([{ name: "tuklas_session", value: T, url: base }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errs.push(e.message); });
  page.on("console", (m) => { if (m.type() === "error" && !/WebSocket|favicon|Failed to load resource.*(401|403|404|413|415|422)/i.test(m.text())) errs.push(m.text().slice(0, 160)); });

  await page.goto(base + "/teacher/lessons/new");
  await page.getByTestId("import-card").waitFor({ timeout: 20000 });
  check(true, "The new-lesson page offers 'Start from a document'");
  check((await page.getByRole("button", { name: "Import draft" }).isDisabled()), "The import button waits for a file");

  // a scanned PDF is refused with the reason
  await page.getByTestId("import-file").setInputFiles(path.join(P22, "scanned-image-only.pdf"));
  await page.getByRole("button", { name: "Import draft" }).click();
  await page.getByTestId("import-error").waitFor({ timeout: 20000 });
  check(/scanned|image-only/i.test(await page.getByTestId("import-error").innerText()), "A scanned PDF is refused and the page says why");

  // the Word lesson
  await page.getByTestId("import-file").setInputFiles(path.join(P45, "lesson-structured.docx"));
  await page.getByRole("button", { name: "Import draft" }).click();
  await page.getByTestId("import-result").waitFor({ timeout: 30000 });
  const text = await page.getByTestId("import-result").innerText();
  check(/Draft created: Subtracting Fractions with Unlike Denominators \(4 sections\)/.test(text), "The page reports the draft and its 4 sections");
  check(/Worked Example 1/.test(text) && /Key Points/.test(text), "...listing them");
  check((await page.getByTestId("import-skipped").innerText()).includes("Answer Key"), "...says the answer key was left out");
  check(/Practice/.test(await page.getByTestId("import-warnings").innerText()) && /does not create questions/.test(await page.getByTestId("import-warnings").innerText()), "...and warns that practice questions must be added in the studio");
  if (shots) await page.screenshot({ path: `${shots}/import-result.png`, fullPage: true });

  await page.getByRole("button", { name: "Open in the editor" }).click();
  await page.waitForURL(/\/teacher\/lessons\/.+\/edit/, { timeout: 15000 });
  const lid = page.url().split("/").slice(-2)[0];
  await page.getByText("Worked Example 1").first().waitFor({ timeout: 20000 });
  check(true, "The studio opens the draft with its sections");
  const body = await page.locator("body").innerText();
  check(!body.includes("ZZ-ANSWER-KEY-7491"), "The answer key text is nowhere on the editor page");
  check((await (await fetch(`${base}/api/lessons/${lid}`, { headers: { Authorization: `Bearer ${S}` } })).status) === 403, "A student cannot open the draft");
  check(errs.length === 0, `No unexpected browser errors (${errs.slice(0, 2).join(" | ")})`);
} catch (e) { failed++; console.log("FAIL crashed: " + (e?.message ?? e)); }
await finish(browser);

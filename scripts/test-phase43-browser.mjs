/**
 * Phase 43 in a real browser (privacy switches ON): the registration checkbox, the acceptance gate, the teacher's guardian-consent
 * checkbox, "Download my data", and the administrator's export and erase.
 *   node scripts/test-phase43-browser.mjs   (spawns its own in-memory dev server; BASE_URL uses one you started with the switches on)
 */
import { chromium } from "playwright-core";
import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";

const external = !!process.env.BASE_URL;
const port = 5600 + Math.floor(Math.random() * 90);
const base = process.env.BASE_URL || `http://127.0.0.1:${port}`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const exe = process.env.CHROMIUM_PATH || fs.readdirSync("/opt/pw-browsers").filter((d) => /^chromium-\d+$/.test(d)).map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`)[0];
let srv;
if (!external) {
  try { fs.rmSync("data/users-persistence.json", { force: true }); } catch { /* */ }
  srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), REQUIRE_PRIVACY_ACCEPTANCE: "true", REQUIRE_GUARDIAN_CONSENT: "true", DATABASE_URL: "" }, stdio: "ignore", detached: true });
}
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log((ok ? "PASS " : "FAIL ") + msg); };
const finish = async (browser) => { try { await browser?.close(); } catch { /* */ } try { if (srv) process.kill(-srv.pid, "SIGTERM"); } catch { /* */ } console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} BROWSER CHECK(S) FAILED`); process.exit(failed === 0 ? 0 : 1); };
for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(base + "/api/health")).ok) break; } catch { /* waiting */ } }
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const run = crypto.randomBytes(3).toString("hex");
const PASS = "Sturdy-Pass1", S_EMAIL = `p43b.s.${run}@example.edu`, T_EMAIL = `p43b.t.${run}@example.edu`;
try {
  // admin (API sign-in, accept the notice so the page works)
  const actx = await browser.newContext();
  await actx.request.post(base + "/api/auth/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  await actx.request.post(base + "/api/auth/accept-privacy");
  check((await actx.request.post(base + "/api/admin/users", { data: { name: "Ms. Teacher", email: T_EMAIL, password: PASS, role: "TEACHER" } })).ok(), "admin creates the teacher");

  // student registers through the dialog
  const sctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const sp = await sctx.newPage();
  await sp.goto(base + "/");
  await sp.getByRole("button", { name: /Sign In/ }).first().click();
  await sp.getByRole("dialog").waitFor();
  await sp.getByRole("button", { name: /Register here/ }).click();
  await sp.getByPlaceholder("e.g. Maria Cruz").fill("Browser Pupil");
  await sp.getByPlaceholder("name@school.edu.ph").fill(S_EMAIL);
  await sp.locator("input[type=password]").fill(PASS);
  const create = sp.getByRole("dialog").getByRole("button", { name: "Create Account", exact: true });
  check(await create.isDisabled(), "Create Account stays disabled until the privacy box is ticked");
  await sp.getByTestId("accept-privacy").check();
  check(await create.isEnabled(), "...and is enabled once it is");
  await create.click();
  await sp.getByRole("dialog").waitFor({ state: "detached", timeout: 15000 });
  check((await sp.locator("[data-testid=privacy-gate]").count()) === 0, "A student who accepted at registration is not asked again");
  const sApi = sctx.request;
  const sid = (await (await sApi.get(base + "/api/auth/me")).json()).user.id;

  // teacher: signs in, meets the gate, accepts
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await tctx.request.post(base + "/api/auth/login", { data: { email: T_EMAIL, password: PASS } });
  const tp = await tctx.newPage();
  await tp.goto(base + "/teacher/classes");
  await tp.getByTestId("privacy-gate").waitFor({ timeout: 15000 });
  check(true, "A teacher who has not accepted sees the privacy gate");
  await tp.getByRole("button", { name: /I have read this and accept/ }).click();
  await tp.getByTestId("privacy-gate").waitFor({ state: "detached", timeout: 10000 });
  check(true, "Accepting closes the gate");
  const cls = (await (await tctx.request.post(base + "/api/teacher/classes", { data: { name: "Grade 7 - Browser", gradeLevel: 7 } })).json()).data;
  await sApi.post(base + "/api/student/classes/join", { data: { code: cls.joinCode } });
  const tutorBefore = await sApi.post(base + "/api/ai/tutor", { data: { studentQuery: "hi", lessonId: "lsn_02" } });
  check(tutorBefore.status() === 403 && (await tutorBefore.json()).code === "GUARDIAN_CONSENT_REQUIRED", "The student's tutor waits for guardian consent");
  await tp.goto(base + `/teacher/classes/${cls.id}`);
  const box = tp.getByTestId(`guardian-${sid}`);
  await box.waitFor({ timeout: 15000 });
  check(!(await box.isChecked()), "The class page shows consent as not recorded");
  await box.check();
  await tp.waitForTimeout(800);
  const roster = (await (await tctx.request.get(base + `/api/teacher/classes/${cls.id}`)).json()).data.students;
  check(roster.find((s) => s.id === sid)?.guardianConsent === true, "Ticking it records the consent on the server");
  await tp.reload(); await tp.getByTestId(`guardian-${sid}`).waitFor({ timeout: 15000 });
  check(await tp.getByTestId(`guardian-${sid}`).isChecked(), "It is still ticked after a reload");
  const tutorAfter = await sApi.post(base + "/api/ai/tutor", { data: { studentQuery: "hi", lessonId: "lsn_02" } });
  check((await tutorAfter.json().catch(() => ({}))).code !== "GUARDIAN_CONSENT_REQUIRED", "The tutor is open once consent is recorded");

  // student downloads their data
  await sp.goto(base + "/account");
  const [dl] = await Promise.all([sp.waitForEvent("download", { timeout: 15000 }), sp.getByRole("button", { name: "Download my data" }).click()]);
  const text = fs.readFileSync(await dl.path(), "utf-8");
  check(dl.suggestedFilename().endsWith(".json") && text.includes(S_EMAIL) && !/passwordHash/.test(text), "'Download my data' gives the student a JSON file with their profile and no password hash");

  // admin export and erase
  const ap = await actx.newPage();
  await ap.goto(base + "/admin");
  await ap.getByLabel("Find a student").fill(S_EMAIL.slice(0, 14));
  await ap.getByRole("button", { name: "Find", exact: true }).click();
  const row = ap.getByTestId(`account-${S_EMAIL}`);
  await row.waitFor({ timeout: 15000 });
  const [dl2] = await Promise.all([ap.waitForEvent("download", { timeout: 15000 }), row.getByRole("button", { name: `Export data of ${S_EMAIL}` }).click()]);
  check(fs.readFileSync(await dl2.path(), "utf-8").includes(S_EMAIL), "The administrator exports a student's data");
  ap.once("dialog", (d) => d.accept("wrong@example.edu"));
  await row.getByRole("button", { name: `Erase ${S_EMAIL}` }).click();
  await ap.waitForTimeout(800);
  check((await ap.getByTestId(`account-${S_EMAIL}`).count()) === 1, "A wrong confirmation does not erase");
  ap.once("dialog", (d) => d.accept(S_EMAIL));
  await ap.getByTestId(`account-${S_EMAIL}`).getByRole("button", { name: `Erase ${S_EMAIL}` }).click();
  await ap.getByTestId(`account-${S_EMAIL}`).waitFor({ state: "detached", timeout: 10000 });
  check(true, "Typing the email erases the account and it leaves the list");
  check((await sApi.get(base + "/api/auth/me")).status() === 401, "The erased student's session stops working");

  // the public notice page
  const pp = await (await browser.newContext()).newPage();
  await pp.goto(base + "/privacy");
  await pp.getByRole("heading", { name: "What is collected" }).waitFor({ timeout: 15000 });
  check(true, "/privacy shows the notice to anyone");
} catch (e) { failed++; console.log("FAIL crashed: " + (e?.message ?? e)); }
await finish(browser);

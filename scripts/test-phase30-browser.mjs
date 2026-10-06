/**
 * Phase 30 real-browser check: sign-in stores no token in the page, the account page changes a password and signs
 * other devices out, "sign out everywhere" works, and an administrator disables a teacher from the admin page.
 *   AI_PROVIDER=local PORT=3000 npx tsx server.ts &     # FRESH in-memory server
 *   node scripts/test-phase30-browser.mjs
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
const errors = [];
const watch = (p) => p.on("pageerror", (e) => { if (!/WebSocket/i.test(e.message)) errors.push(e.message); });

const stamp = Date.now();
const email = `ph${stamp}@school.test`;
const pw1 = "Stud3ntPass9", pw2 = "N3wStudentPass7";

// ---- A: a student registers through the API, then signs in through the real sign-in dialog
const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctxA.request.post(base + "/api/auth/register", { data: { name: "Account Tester", email, password: pw1 } });
await ctxA.clearCookies();
const A = await ctxA.newPage(); watch(A);
await A.goto(base + "/");
await A.getByRole("button", { name: /Sign In/i }).first().click();
await A.getByPlaceholder("name@school.edu.ph").fill(email);
await A.getByPlaceholder("••••••••").fill(pw1);
await A.getByRole("dialog").getByRole("button", { name: /^Sign In$/i }).click();
await A.waitForFunction(() => document.body.innerText.includes("Account Tester"), null, { timeout: 15000 });
// sign-in may still be navigating when the name appears: let the page settle before reading storage (this raced about 1 run in 4)
await A.waitForLoadState("networkidle").catch(() => {});
await A.waitForTimeout(400);
const stored = await A.evaluate(() => Object.keys(localStorage).concat(Object.keys(sessionStorage)).filter((k) => /token|session/i.test(k)));
check(stored.length === 0, `signing in leaves no token in localStorage/sessionStorage (${JSON.stringify(stored)})`);
const cookies = await ctxA.cookies();
const sess = cookies.find((c) => c.name === "tuklas_session");
check(!!sess && sess.httpOnly === true && sess.sameSite === "Lax", "the session is an HttpOnly, SameSite=Lax cookie that page scripts cannot read");
check(!(await A.evaluate(() => document.cookie)).includes("tuklas_session"), "document.cookie does not expose it");

// ---- B: the same student on a second device
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const loginB = await ctxB.request.post(base + "/api/auth/login", { data: { email, password: pw1 } });
check(loginB.ok(), "the same account is signed in on a second device");
const B = await ctxB.newPage(); watch(B);
await B.goto(base + "/student"); await B.waitForTimeout(2000);
check(await B.getByText(/Welcome back/).count() > 0, "device B shows the student dashboard");

// ---- A changes the password on the account page
await A.getByRole("link", { name: "Account Tester" }).first().click();
await A.getByTestId("change-password-form").waitFor({ timeout: 10000 });
await A.getByLabel("Current password").fill("wrong-current-1");
await A.getByLabel("New password", { exact: true }).fill(pw2);
await A.getByLabel("Confirm new password").fill("different-9");
await A.getByRole("button", { name: "Change password" }).click();
check(/do not match/i.test(await A.getByRole("status").innerText()), "mismatched confirmation is caught before sending");
await A.getByLabel("Confirm new password").fill(pw2);
await A.getByRole("button", { name: "Change password" }).click();
await A.getByRole("status").filter({ hasText: /incorrect/i }).waitFor({ timeout: 10000 });
check(true, "a wrong current password is refused with a clear message");
await A.getByLabel("Current password").fill(pw1);
await A.getByRole("button", { name: "Change password" }).click();
await A.getByRole("status").filter({ hasText: /Password changed/i }).waitFor({ timeout: 10000 });
check(true, "the password is changed");
await A.goto(base + "/student"); await A.waitForTimeout(1500);
check(await A.getByText(/Welcome back/).count() > 0, "device A stays signed in after the change");
await B.reload(); await B.waitForTimeout(2000);
check(await B.getByText(/Welcome back/).count() === 0, "device B is signed out by the change (it no longer shows the dashboard)");
const old = await ctxB.request.post(base + "/api/auth/login", { data: { email, password: pw1 } });
const neu = await ctxB.request.post(base + "/api/auth/login", { data: { email, password: pw2 } });
check(old.status() === 401 && neu.ok(), "the old password is refused and the new one works");

// ---- "Sign out everywhere"
await A.goto(base + "/account"); await A.getByTestId("change-password-form").waitFor({ timeout: 10000 });
A.once("dialog", (d) => d.accept());
await A.getByRole("button", { name: "Sign out on all devices" }).click();
await A.waitForFunction(() => !document.body.innerText.includes("My account") || document.body.innerText.includes("Sign in to manage"), null, { timeout: 10000 });
const meAfter = await ctxB.request.get(base + "/api/auth/me");
check(meAfter.status() === 401, "after 'sign out everywhere' the other device's session is dead too");

// ---- Admin disables a teacher from the admin page
const ctxAdmin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctxAdmin.request.post(base + "/api/auth/login", { data: { email: "admin@tuklas.ai", password: "Tuklas2026!" } });
const tEmail = `tt${stamp}@school.test`;
await ctxAdmin.request.post(base + "/api/admin/users", { data: { name: "Browser Teacher", email: tEmail, password: "Teach3rPass9", role: "TEACHER" } });
// (plain fetch: the teacher's login must not replace the administrator's cookie in the browser context)
const tLogin = await (await fetch(base + "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: tEmail, password: "Teach3rPass9" }) })).json();
const tTokenOk = async () => (await fetch(base + "/api/auth/me", { headers: { Authorization: `Bearer ${tLogin.token}` } })).status;
check((await tTokenOk()) === 200, "the teacher is signed in");
const AD = await ctxAdmin.newPage(); watch(AD);
await AD.goto(base + "/admin");
const row = AD.getByTestId(`account-${tEmail}`);
await row.waitFor({ timeout: 15000 });
await row.getByRole("button", { name: "Disable" }).click();
await AD.getByTestId(`account-${tEmail}`).getByText(/disabled/).waitFor({ timeout: 10000 });
check(true, "the admin page shows the teacher as disabled");
check((await tTokenOk()) === 401, "the teacher's session stopped working immediately");
await AD.getByTestId("audit-list").getByText("admin.user.disable").first().waitFor({ timeout: 10000 });
check(true, "the security activity list shows the action");
await AD.getByTestId(`account-${tEmail}`).getByRole("button", { name: "Enable" }).click();
await AD.getByTestId(`account-${tEmail}`).getByRole("button", { name: "Disable" }).waitFor({ timeout: 10000 });
check(true, "the admin can enable the account again");
if (process.env.SCREENSHOT_DIR) await AD.screenshot({ path: `${process.env.SCREENSHOT_DIR}/admin-accounts.png`, fullPage: true });
check(errors.length === 0, "no uncaught page errors" + (errors.length ? " -> " + errors[0] : ""));
await browser.close();
console.log(failed === 0 ? "\nALL BROWSER CHECKS PASSED" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);

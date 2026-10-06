/**
 * Tuklas AI - Phase 30: session revocation, account controls, CSRF / origin protection, security headers and the audit log.
 *   in-memory:   AI_PROVIDER=local npx tsx scripts/test-phase30-sessions.ts
 *   PostgreSQL:  DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase30-sessions.ts
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p30.${t}.${run}@example.edu`;

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => {
  if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); }
};
const section = (t: string) => console.log(`\n--- ${t} ---`);
const meta = (o: object) => JSON.stringify(o);

async function main() {
  const port = 4000 + Math.floor(Math.random() * 90);
  const base = `http://127.0.0.1:${port}`;
  const secret = crypto.randomBytes(32).toString("hex");
  const signToken = (payload: object) => { const enc = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${enc}.${crypto.createHmac("sha256", secret).update(enc).digest("base64url")}`; };
  let server: ChildProcess | undefined;
  const start = async () => {
    server = spawn("npx", ["tsx", "server.ts"], {
      env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: secret },
      stdio: ["ignore", "ignore", "ignore"], detached: true,
    });
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* waiting */ }
    }
    throw new Error("server did not start");
  };
  const stop = async () => { try { if (server?.pid) process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ } await new Promise((r) => setTimeout(r, 1500)); };
  const api = async (method: string, path: string, token?: string, body?: unknown, extraHeaders: Record<string, string> = {}) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = {};
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text, headers: res.headers, setCookie: (res.headers as any).getSetCookie?.() as string[] | undefined };
  };
  const login = async (e: string, p: string) => (await api("POST", "/api/auth/login", undefined, { email: e, password: p })).json.token as string;

  try {
    await start();
    console.log(`\nServer up (${DB_MODE ? "PostgreSQL" : "in-memory"} mode)`);

    section("1. Setup");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminId = (await api("GET", "/api/auth/me", admin)).json.user.id as string;
    const mk = async (tag: string, role: string) => {
      const r = await api("POST", "/api/admin/users", admin, { name: `P30 ${tag}`, email: email(tag), password: PASSWORD, role });
      return r.json.data.id as string;
    };
    const idU1 = await mk("u1", "TEACHER");
    const idU2 = await mk("u2", "TEACHER");
    const idU3 = await mk("u3", "TEACHER");
    const idU4 = await mk("u4", "TEACHER");
    const idU5 = await mk("u5", "TEACHER");
    const me = (tok?: string) => api("GET", "/api/auth/me", tok);

    section("2. Changing the password signs out every other device");
    const a1 = await login(email("u1"), PASSWORD), a2 = await login(email("u1"), PASSWORD);
    assert((await me(a1)).status === 200 && (await me(a2)).status === 200, "Two devices are signed in");
    const NEWPW = "Fresh-Pass-77";
    const wrongCur = await api("POST", "/api/auth/change-password", a1, { currentPassword: "nope", newPassword: NEWPW });
    assert(wrongCur.status === 401 && (await me(a2)).status === 200, "A wrong current password changes nothing and signs nobody out");
    const chg = await api("POST", "/api/auth/change-password", a1, { currentPassword: PASSWORD, newPassword: NEWPW });
    assert(chg.status === 200 && typeof chg.json.token === "string", "Changing the password succeeds and returns a fresh token for this device");
    assert((await me(a1)).status === 401 && (await me(a2)).status === 401, "Both OLD tokens stop working immediately (previously they stayed valid for 7 days)");
    assert((await me(chg.json.token)).status === 200, "The fresh token works: this device stays signed in");
    assert(!(await login(email("u1"), PASSWORD)) && !!(await login(email("u1"), NEWPW)), "The old password no longer signs in; the new one does");

    section("3. 'Sign out everywhere'");
    const b1 = await login(email("u2"), PASSWORD), b2 = await login(email("u2"), PASSWORD);
    assert((await api("POST", "/api/auth/logout-all", undefined, {})).status === 401, "Signed out -> 401");
    assert((await api("POST", "/api/auth/logout-all", b1, {})).status === 200, "Sign out everywhere");
    assert((await me(b1)).status === 401 && (await me(b2)).status === 401, "Every token of that user is dead, including the one on the other device");
    assert(!!(await login(email("u2"), PASSWORD)), "The user can sign in again");

    section("4. An administrator can disable, enable, sign out and reset");
    const c1 = await login(email("u3"), PASSWORD);
    assert((await api("POST", `/api/admin/users/${idU3}/disable`, c1, {})).status === 403, "A non-administrator cannot disable anyone");
    assert((await api("POST", `/api/admin/users/${idU3}/disable`, admin, {})).status === 200, "Administrator disables the account");
    assert((await me(c1)).status === 401, "The disabled user's existing token stops working at once");
    const blocked = await api("POST", "/api/auth/login", undefined, { email: email("u3"), password: PASSWORD });
    const wrong = await api("POST", "/api/auth/login", undefined, { email: email("u3"), password: "Wrong-pass-9" });
    assert(blocked.status === 401 && blocked.json.error === wrong.json.error, "A disabled account cannot sign in, and gets the same generic error as a wrong password");
    assert((await api("GET", "/api/admin/users?role=TEACHER", admin)).json.data.users.find((u: any) => u.id === idU3)?.disabled === true, "The user list shows it as disabled");
    assert((await api("POST", `/api/admin/users/${idU3}/enable`, admin, {})).status === 200, "Administrator enables it again");
    assert((await me(c1)).status === 401, "...but the OLD token does not come back");
    assert(!!(await login(email("u3"), PASSWORD)), "...while a fresh sign-in works");

    const d1 = await login(email("u4"), PASSWORD);
    assert((await api("POST", `/api/admin/users/${idU4}/revoke-sessions`, admin, {})).status === 200 && (await me(d1)).status === 401, "Administrator signs a user out of every device");
    const e1 = await login(email("u5"), PASSWORD);
    const TEMP = "Temp-Pass-4242";
    assert((await api("POST", `/api/admin/users/${idU5}/reset-password`, admin, { temporaryPassword: "short" })).status === 400, "A weak temporary password is refused");
    assert((await api("POST", `/api/admin/users/${idU5}/reset-password`, admin, { temporaryPassword: TEMP })).status === 200, "Administrator resets a password");
    assert((await me(e1)).status === 401 && !(await login(email("u5"), PASSWORD)) && !!(await login(email("u5"), TEMP)), "The old session and old password are dead; the temporary password works");

    section("5. A role change takes effect at once");
    const f1 = await login(email("u1"), NEWPW);
    assert((await api("POST", "/api/teacher/classes", f1, { name: `P30 role test ${run}` })).status === 201, "As a TEACHER the user can create a class");
    assert((await api("POST", `/api/admin/users/${idU1}/role`, admin, { role: "NONSENSE" })).status === 400, "An invalid role is refused");
    assert((await api("POST", `/api/admin/users/${idU1}/role`, admin, { role: "STUDENT" })).status === 200, "Administrator demotes the teacher to STUDENT");
    assert((await me(f1)).status === 401, "The old teacher token stops working");
    const f2 = await login(email("u1"), NEWPW);
    assert((await api("POST", "/api/teacher/classes", f2, { name: "should fail" })).status === 403 && (await me(f2)).json.user.role === "STUDENT", "After signing in again the user really is a STUDENT");

    section("6. Guards on the administrator actions");
    for (const action of ["disable", "role"]) {
      const r = await api("POST", `/api/admin/users/${adminId}/${action}`, admin, { role: "TEACHER" });
      assert(r.status === 409, `An administrator cannot ${action === "role" ? "demote" : "disable"} their own account`);
    }
    assert((await api("POST", `/api/admin/users/${adminId}/reset-password`, admin, { temporaryPassword: TEMP })).status === 409, "...or reset their own password this way (use Change password)");
    assert((await api("POST", "/api/admin/users/does-not-exist/disable", admin, {})).status === 404, "An unknown user -> 404");
    assert((await api("GET", "/api/admin/audit", f2)).status === 403, "A non-administrator cannot read the audit log");

    section("7. Tokens cannot be forged or kept past a revocation");
    const now = Date.now();
    // u2 was signed out once above, so its current session version is 1
    const base30 = { userId: idU2, email: email("u2"), name: "P30 u2", role: "TEACHER", createdAt: now, expiresAt: now + 3600_000 };
    assert((await me(signToken({ ...base30, sv: 1 }))).status === 200, "A correctly signed token with the current version is accepted");
    assert((await me(signToken({ ...base30, sv: 0 }))).status === 401, "A correctly signed token with an OLD version is refused");
    assert((await me(signToken({ ...base30 }))).status === 401, "A legacy token with no version is refused once the user has been signed out");
    const forged = signToken({ ...base30, sv: 1 }).split(".");
    const tampered = Buffer.from(JSON.stringify({ ...base30, sv: 1, role: "ADMIN" })).toString("base64url") + "." + forged[1];
    assert((await me(tampered)).status === 401, "A token with its role edited to ADMIN fails the signature check");
    assert((await me(signToken({ ...base30, sv: 1, expiresAt: now - 1000 }))).status === 401, "An expired token is refused");
    assert((await me(signToken({ ...base30, userId: "ghost-user", sv: 0 }))).status === 401, "A token for an account that does not exist is refused");
    assert((await me("garbage")).status === 401 && (await me("a.b")).status === 401, "Garbage tokens are refused");

    section("8. Cross-site request protection (cookie sessions)");
    const cookieLogin = await api("POST", "/api/auth/login", undefined, { email: email("u2"), password: PASSWORD });
    const cookieHeaderLine = (cookieLogin.setCookie ?? []).find((c) => c.startsWith("tuklas_session="))!;
    assert(/HttpOnly/i.test(cookieHeaderLine) && /SameSite=Lax/i.test(cookieHeaderLine), "The session cookie is HttpOnly and SameSite=Lax");
    assert(!/;\s*Secure/i.test(cookieHeaderLine), "(over plain http in development it is not marked Secure)");
    const httpsLogin = await api("POST", "/api/auth/login", undefined, { email: email("u2"), password: PASSWORD }, { "X-Forwarded-Proto": "https" });
    assert(/;\s*Secure/i.test((httpsLogin.setCookie ?? []).find((c) => c.startsWith("tuklas_session="))!), "...and is Secure when the request arrived over https");
    const cookie = cookieHeaderLine.split(";")[0];
    const sameOrigin = base;
    const csrf = (headers: Record<string, string>, tok?: string) => api("POST", "/api/teacher/classes", tok, { name: `P30 csrf ${Math.random()}` }, headers);
    assert((await csrf({ Cookie: cookie, Origin: sameOrigin })).status === 201, "A cookie-authenticated POST from this site's own origin works");
    assert((await csrf({ Cookie: cookie })).status === 201, "A cookie POST with no Origin (a non-browser client) works");
    assert((await csrf({ Cookie: cookie, Origin: "https://evil.example" })).status === 403, "A cookie POST from another origin is refused");
    assert((await csrf({ Cookie: cookie, Origin: "null" })).status === 403, "A cookie POST with Origin: null (sandboxed page) is refused");
    assert((await csrf({ Cookie: cookie, "Sec-Fetch-Site": "cross-site" })).status === 403, "A browser-marked cross-site cookie POST (no Origin) is refused");
    assert((await csrf({ Cookie: cookie, "Sec-Fetch-Site": "same-origin", Origin: sameOrigin })).status === 201, "A browser-marked same-origin POST works");
    assert((await api("PATCH", "/api/teacher/classes/x", undefined, { name: "x" }, { Cookie: cookie, Origin: "https://evil.example" })).status === 403, "PATCH from another origin is refused too");
    assert((await api("POST", "/api/auth/login", undefined, { email: email("u2"), password: PASSWORD }, { Origin: "https://evil.example" })).status === 403, "A login POST from another origin is refused (login CSRF)");
    assert((await api("POST", "/api/auth/logout", undefined, {}, { Cookie: cookie, Origin: "https://evil.example" })).status === 403, "A forced logout from another origin is refused");
    assert((await api("GET", "/api/auth/me", undefined, undefined, { Cookie: cookie, Origin: "https://evil.example" })).status === 200, "Reading (GET) is not blocked by the origin rule");
    const t2 = await login(email("u2"), PASSWORD);
    assert((await csrf({ Origin: "https://evil.example" }, t2)).status === 201, "A request with an Authorization header is exempt (a forged cross-site request cannot set it)");

    section("9. Security headers");
    const hdr = await api("GET", "/api/health");
    assert(hdr.headers.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
    assert(hdr.headers.get("referrer-policy") === "strict-origin-when-cross-origin", "Referrer-Policy is set");
    assert(/no-store/.test(hdr.headers.get("cache-control") ?? ""), "API responses are Cache-Control: no-store");
    assert(/camera=\(\)/.test(hdr.headers.get("permissions-policy") ?? ""), "Permissions-Policy restricts the camera");

    section("10. The audit log");
    const aud = await api("GET", "/api/admin/audit?limit=200", admin);
    const entries = aud.json.data.entries as any[];
    const has = (action: string, target?: string) => entries.some((e) => e.action === action && (!target || e.targetId === target));
    assert(aud.status === 200 && aud.json.data.total >= 10, `The audit log has entries (${aud.json.data.total})`);
    assert(has("admin.user.create", idU1) && has("auth.password.change", idU1) && has("auth.sessions.revoke_all", idU2), "Account creation, password change and sign-out-everywhere are recorded");
    assert(has("admin.user.disable", idU3) && has("admin.user.enable", idU3) && has("admin.user.revoke_sessions", idU4) && has("admin.user.reset_password", idU5) && has("admin.user.role", idU1), "Every administrator account action is recorded against its target");
    assert(entries.filter((e) => e.action.startsWith("admin.user.")).every((e) => e.actorId === adminId), "...with the administrator as the actor");
    assert(has("auth.login.blocked_disabled", idU3), "A sign-in attempt on a disabled account is recorded");
    assert(!aud.text.includes(TEMP) && !aud.text.includes(NEWPW) && !aud.text.includes(PASSWORD) && !/passwordHash|\$2[aby]\$/.test(aud.text), "No password, temporary password or hash appears anywhere in the log");
    const T = await login(email("u3"), PASSWORD);
    const unit = (await api("GET", "/api/curriculum", T)).json.data?.[0]?.grades?.[0]?.terms?.[0]?.units?.[0];
    const les = (await api("POST", "/api/lessons", T, { title: `P30 lesson ${run}`, unitId: unit.id, learningObjectives: ["x"] })).json.data.id as string;
    const blk = (await api("POST", `/api/lessons/${les}/blocks`, T, { type: "CHECKPOINT", title: "Q", content: "Q", metadata: JSON.stringify({ options: ["a", "b"], correctAnswer: "a" }) })).json.data.id as string;
    await api("PUT", `/api/lessons/${les}/blocks/${blk}`, T, { metadata: JSON.stringify({ options: ["a", "b"], correctAnswer: "b" }) });
    await api("POST", `/api/lessons/${les}/status`, T, { targetStatus: "REVIEW" });
    const aud2 = (await api("GET", "/api/admin/audit?limit=200", admin)).json.data.entries as any[];
    assert(aud2.some((e) => e.action === "block.create" && e.targetId === blk) && aud2.some((e) => e.action === "block.update" && e.targetId === blk) && aud2.some((e) => e.action === "lesson.status" && e.targetId === les), "Block creation, an answer-key edit and a lesson status change are recorded");
    assert(!JSON.stringify(aud2).includes("correctAnswer"), "...without the content of the answer key itself");
    assert((await api("GET", "/api/admin/audit?action=admin.user.", admin)).json.data.entries.every((e: any) => e.action.startsWith("admin.user.")), "The audit log can be filtered by action prefix");
  } finally {
    await stop();
  }

  console.log(`\n======================================================\nPHASE 30 RESULTS (${DB_MODE ? "PostgreSQL" : "in-memory"}): ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("ALL PHASE 30 CHECKS PASSED (see docs/PHASE_30_VERIFICATION.md for what is NOT covered).");
  process.exit(0);
}
main().catch((e) => { console.error("Phase 30 suite crashed:", e); process.exit(1); });

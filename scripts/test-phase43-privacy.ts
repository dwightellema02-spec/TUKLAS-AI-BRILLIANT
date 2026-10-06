/**
 * Tuklas AI - Phase 43: student-data privacy. Black-box over HTTP against a spawned server with the production privacy switches on
 * (REQUIRE_PRIVACY_ACCEPTANCE, REQUIRE_GUARDIAN_CONSENT). The same suite runs in both modes:
 *   in-memory:   AI_PROVIDER=local npx tsx scripts/test-phase43-privacy.ts
 *   PostgreSQL:  DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... (the wrapper test-phase43-prisma.ts creates the admin and runs this)
 * Covers: public notice, acceptance at registration and the gate, guardian consent and the tutor gate, personal-data export,
 * erasure rules, audit rows and server logs free of personal data, de-identified research exports.
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

process.env.AI_PROVIDER = "local";
const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);

const run = crypto.randomBytes(3).toString("hex");
const email = (tag: string) => `p43.${tag}.${run}@example.edu`;
const PASSWORD = "Sturdy-Pass1";

async function main() {
  const port = 3500 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
  let logs = "";
  const server: ChildProcess = spawn("npx", ["tsx", "server.ts"], {
    env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), REQUIRE_PRIVACY_ACCEPTANCE: "true", REQUIRE_GUARDIAN_CONSENT: "true" },
    stdio: ["ignore", "pipe", "pipe"], detached: true,
  });
  server.stdout?.on("data", (d) => (logs += d)); server.stderr?.on("data", (d) => (logs += d));
  try {
    let up = false;
    for (let i = 0; i < 90 && !up; i++) { await new Promise((r) => setTimeout(r, 500)); try { up = (await fetch(`${base}/api/health`)).ok; } catch { /* waiting */ } }
    if (!up) throw new Error("server did not start");
    console.log(`Server up (${DB_MODE ? "PostgreSQL" : "in-memory"} mode)`);

    type R = { status: number; json: any; text: string; headers: Headers };
    const api = async (method: string, path: string, token?: string, body?: unknown): Promise<R> => {
      const res = await fetch(base + path, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
      const text = await res.text(); let json: any = {}; try { json = JSON.parse(text); } catch { /* not json */ }
      return { status: res.status, json, text, headers: res.headers };
    };
    const login = async (e: string, p: string) => { const r = await api("POST", "/api/auth/login", undefined, { email: e, password: p }); return r.status === 200 ? (r.json.token as string) : undefined; };
    const accept = async (tok: string) => (await api("POST", "/api/auth/accept-privacy", tok)).status;

    section("1. The notice is public and honest");
    const n = await api("GET", "/api/privacy-notice");
    assert(n.status === 200 && !!n.json.data?.version && JSON.stringify(n.json.data).length > 500, "The notice is available without signing in");
    assert(n.json.data.externalAi === false && /does not send your messages to any outside AI/.test(JSON.stringify(n.json.data)), "With the local tutor it says no message leaves the system (it follows the real setting, not a fixed text)");
    assert(["who", "what", "why", "who-sees", "ai", "keep", "rights", "minors"].every((id) => n.json.data.sections.some((x: any) => x.id === id)), "It covers who, what, why, who sees it, the AI, retention, rights and minors");

    section("2. Registration needs the privacy notice accepted");
    const noAccept = await api("POST", "/api/auth/register", undefined, { name: "Ana Reyes", email: email("noacc"), password: PASSWORD });
    assert(noAccept.status === 400 && noAccept.json.code === "PRIVACY_NOT_ACCEPTED", "Registering without accepting is refused");
    const falseAccept = await api("POST", "/api/auth/register", undefined, { name: "Ana Reyes", email: email("noacc"), password: PASSWORD, acceptPrivacy: "yes" });
    assert(falseAccept.status === 400, "Only a real true counts as accepting");
    const reg = async (tag: string, name: string, role?: string) => api("POST", "/api/auth/register", undefined, { name, email: email(tag), password: PASSWORD, acceptPrivacy: true, ...(role ? { role } : {}) });
    const rs1 = await reg("s1", "Ana Reyes");
    assert(rs1.status === 200 || rs1.status === 201, "Registering with acceptance works");
    const S1 = rs1.json.token as string;
    const me = await api("GET", "/api/auth/me", S1);
    assert(me.json.privacy?.required === true && me.json.privacy?.needsAcceptance === false && me.json.privacy?.guardianConsent === false, "/me shows: enforced, accepted, no guardian consent yet");

    section("3. The gate: an account that has not accepted can do nothing else");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    assert(!!admin, "Administrator can sign in");
    if (!admin) throw new Error("no admin token");
    const gated = await api("GET", "/api/admin/users", admin);
    if (gated.status === 403 && gated.json.code === "PRIVACY_NOT_ACCEPTED") {
      assert(true, "An account that has not accepted is stopped with PRIVACY_NOT_ACCEPTED");
      assert((await api("GET", "/api/auth/me", admin)).status === 200 && (await api("GET", "/api/privacy-notice", admin)).status === 200 && (await api("GET", "/api/health")).status === 200, "...but can still read the notice, /me and health");
      assert((await api("GET", "/api/me/data-export", admin)).status === 200, "...and download its own data");
      assert((await accept(admin)) === 200, "Accepting lifts the gate");
    } else {
      assert(gated.status === 200, "The demo administrator already had the notice accepted (in-memory seed)");
      await accept(admin);
    }
    assert((await api("GET", "/api/admin/users", admin)).status === 200, "After acceptance the administrator works normally");

    const T = await (async () => {
      const c = await api("POST", "/api/admin/users", admin, { name: "Mr Teacher", email: email("t"), password: PASSWORD, role: "TEACHER" });
      assert(c.status === 201, "Admin creates a teacher");
      const tok = (await login(email("t"), PASSWORD))!; await accept(tok); return tok;
    })();
    const T2 = await (async () => {
      await api("POST", "/api/admin/users", admin, { name: "Ms Other", email: email("t2"), password: PASSWORD, role: "TEACHER" });
      const tok = (await login(email("t2"), PASSWORD))!; await accept(tok); return tok;
    })();
    const unaccepted = await reg("s2", "Ben Cruz"); // accepted at registration; take the gate away by testing a fresh login of a teacher that never accepted
    const S2 = unaccepted.json.token as string;
    await api("POST", "/api/admin/users", admin, { name: "Ms Never", email: email("tn"), password: PASSWORD, role: "TEACHER" });
    const TN = (await login(email("tn"), PASSWORD))!;
    const tnGate = await api("GET", "/api/teacher/classes", TN);
    assert(tnGate.status === 403 && tnGate.json.code === "PRIVACY_NOT_ACCEPTED", "An admin-created teacher must accept before using anything");
    assert((await accept(TN)) === 200 && (await api("GET", "/api/teacher/classes", TN)).status === 200, "...and can after accepting");

    section("4. Guardian consent");
    const cls = await api("POST", "/api/teacher/classes", T, { name: "Grade 7 - Privacy", gradeLevel: 7 });
    const C1 = cls.json.data.id as string, code = cls.json.data.joinCode as string;
    const S1id = me.json.user.id as string, S2id = (await api("GET", "/api/auth/me", S2)).json.user.id as string;
    await api("POST", "/api/student/classes/join", S1, { code });
    const detail0 = await api("GET", `/api/teacher/classes/${C1}`, T);
    const row0 = (detail0.json.data.students as any[]).find((s) => s.id === S1id);
    assert(row0 && row0.guardianConsent === false, "The class roster shows guardian consent as not recorded");
    const tutor = (tok: string) => api("POST", "/api/ai/tutor", tok, { message: "What is 2 + 3?", lessonId: "x", conversationId: undefined });
    const blocked = await tutor(S1);
    assert(blocked.status === 403 && blocked.json.code === "GUARDIAN_CONSENT_REQUIRED", "With the school's setting on, the tutor waits for the guardian's consent");
    assert((await api("POST", `/api/teacher/students/${S1id}/guardian-consent`, S1, { given: true })).status === 403, "A student cannot record their own consent");
    assert((await api("POST", `/api/teacher/students/${S1id}/guardian-consent`, T2, { given: true })).status === 403, "A teacher of other classes cannot record it");
    assert((await api("POST", `/api/teacher/students/${S2id}/guardian-consent`, T, { given: true })).status === 403, "...nor for a student who is not in their class");
    assert((await api("POST", `/api/teacher/students/${S1id}/guardian-consent`, T, { given: "yes" })).status === 400, "The value must be true or false");
    const given = await api("POST", `/api/teacher/students/${S1id}/guardian-consent`, T, { given: true });
    assert(given.status === 200 && given.json.data.guardianConsent === true, "The class teacher records the consent");
    const after = await tutor(S1);
    assert(after.json.code !== "GUARDIAN_CONSENT_REQUIRED", "The tutor is no longer blocked by consent");
    const detail1 = await api("GET", `/api/teacher/classes/${C1}`, T);
    assert((detail1.json.data.students as any[]).find((s) => s.id === S1id)?.guardianConsent === true, "The roster now shows it");
    assert((await api("POST", `/api/teacher/students/${S1id}/guardian-consent`, T, { given: false })).status === 200 && (await tutor(S1)).json.code === "GUARDIAN_CONSENT_REQUIRED", "Withdrawing the consent closes the tutor again");
    await api("POST", `/api/teacher/students/${S1id}/guardian-consent`, T, { given: true });

    section("5. Access: a person's own data");
    const mine = await api("GET", "/api/me/data-export", S1);
    assert(mine.status === 200 && /attachment/.test(mine.headers.get("content-disposition") ?? ""), "A student downloads their data as a file");
    assert(mine.json.data?.profile?.email === email("s1") && !/passwordHash|\$2[aby]\$|sessionVersion/i.test(mine.text), "It has their profile and never the password hash or session internals");
    assert((await api("GET", "/api/me/data-export")).status === 401, "Anonymous cannot export");
    assert((await api("GET", `/api/admin/users/${S1id}/data-export`, T)).status === 403 && (await api("GET", `/api/admin/users/${S1id}/data-export`, S1)).status === 403, "Only an administrator exports someone else's data");
    const adminExp = await api("GET", `/api/admin/users/${S1id}/data-export`, admin);
    assert(adminExp.status === 200 && adminExp.json.data?.profile?.id === S1id, "An administrator can export a student's data");
    assert((await api("GET", `/api/admin/users/nope-${run}/data-export`, admin)).status === 404, "Unknown account: 404");

    section("6. Erasure");
    const found = await api("GET", `/api/admin/users?role=STUDENT&q=${encodeURIComponent(email("s2").slice(0, 12))}`, admin);
    assert(found.status === 200 && found.json.data.users.some((x: any) => x.id === S2id) && found.json.data.users.every((x: any) => x.role === "STUDENT"), "The administrator can find a student by part of their email");
    assert((await api("GET", `/api/admin/users?role=STUDENT&q=x`, T)).status === 403, "A teacher cannot search accounts");
    const erase = (tok: string, id: string, confirmEmail: unknown) => api("POST", `/api/admin/users/${id}/erase`, tok, { confirmEmail });
    assert((await erase(T, S2id, email("s2"))).status === 403 && (await erase(S2, S2id, email("s2"))).status === 403, "Only an administrator can erase");
    assert((await erase(admin, S2id, "someone@else.edu")).status === 400 && (await erase(admin, S2id, undefined)).status === 400, "The account's own email must be typed to confirm");
    const adminId = (await api("GET", "/api/auth/me", admin)).json.user.id as string;
    assert((await erase(admin, adminId, ADMIN_EMAIL)).status === 409, "An administrator cannot erase their own account");
    const tId = (await api("GET", "/api/auth/me", T)).json.user.id as string;
    if (DB_MODE) assert((await erase(admin, tId, email("t"))).status === 409, "A teacher who still teaches a class cannot be erased (it would delete the students' class records)");
    const gone = await erase(admin, S2id, email("S2").toUpperCase());
    assert(gone.status === 200 && gone.json.data?.erased === true, "A student is erased (the email check ignores letter case)");
    assert((await api("GET", "/api/auth/me", S2)).status === 401, "Their session stops working at once");
    assert((await login(email("s2"), PASSWORD)) === undefined, "They can no longer sign in");
    assert((await api("GET", `/api/admin/users/${S2id}/data-export`, admin)).status === 404, "Nothing is left to export");
    assert((await erase(admin, S2id, email("s2"))).status === 404, "Erasing twice: 404");

    section("7. The audit log and the server log hold no personal data");
    const audit = await api("GET", "/api/admin/audit?limit=200", admin);
    const rows: any[] = audit.json.data?.entries ?? audit.json.data?.rows ?? audit.json.data ?? [];
    const eraseRow = (Array.isArray(rows) ? rows : []).find((r) => r.action === "privacy.erase");
    assert(!!eraseRow, "The erasure is in the audit log");
    assert(!JSON.stringify(eraseRow ?? {}).includes(email("s2")) && !JSON.stringify(eraseRow ?? {}).includes("Ben Cruz"), "...without the erased person's email or name");
    assert((Array.isArray(rows) ? rows : []).some((r) => r.action === "privacy.export.admin") && (Array.isArray(rows) ? rows : []).some((r) => r.action === "privacy.export.self"), "Exports are recorded as well");
    assert(!logs.includes(email("s1")) && !logs.includes(email("s2")) && !logs.includes("Ana Reyes") && !logs.includes("Ben Cruz"), "The server's log contains no student emails or names");

    section("8. Research exports are de-identified unless asked, and asking is audited");
    const stud = await api("GET", `/api/teacher/research/export/metrics.csv?classroomId=${C1}`, T);
    assert(stud.status === 200 && /S-[0-9a-f]{10}/.test(stud.text) && !stud.text.includes("Ana Reyes") && !stud.text.includes(S1id), "Default export: a code, no name, no account id");
    const stud2 = await api("GET", `/api/teacher/research/export/metrics.csv?classroomId=${C1}`, T);
    assert(stud.text.match(/S-[0-9a-f]{10}/)?.[0] === stud2.text.match(/S-[0-9a-f]{10}/)?.[0], "The code is stable between exports (a researcher can follow a student over time)");
    const ident = await api("GET", `/api/teacher/research/export/metrics.csv?classroomId=${C1}&identified=true`, T);
    assert(ident.status === 200 && ident.text.includes("Ana Reyes"), "An identified export includes the name when the teacher asks");
    const audit2 = await api("GET", "/api/admin/audit?limit=200&action=research.export.identified", admin);
    const rows2: any[] = audit2.json.data?.entries ?? audit2.json.data?.rows ?? audit2.json.data ?? [];
    assert(Array.isArray(rows2) && rows2.length >= 1, "...and that request is in the audit log");
  } finally {
    if (server.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* */ } }
  }
  console.log(`\nPHASE 43 PRIVACY RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

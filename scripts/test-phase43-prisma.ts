/**
 * Tuklas AI - Phase 43 on PostgreSQL. Brand-new database built by the REAL migrations (`prisma migrate deploy`), then:
 *   A. the HTTP privacy suite (same file as the in-memory run)
 *   B. erasure completeness: a student with data in many tables is erased; no row anywhere still points at them (found by reading the
 *      database's own foreign keys, not a hand-kept list); other students' rows are untouched
 *   C. the personal-data export contains the tutor conversation
 *   D. retention: dry run changes nothing; --apply removes only old tutor conversations and clears only old addresses
 */
import crypto from "crypto";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";
import { runRetention } from "./retention";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
  const run = crypto.randomBytes(3).toString("hex");
  const dbName = `tuklas_p43_${run}`;
  const u = new URL(url); const adminUrl = new URL(url); adminUrl.pathname = "/postgres"; u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`); await root.$disconnect();
  const env = { ...process.env, DATABASE_URL: freshUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) => spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  let server: ChildProcess | undefined;
  try {
    console.log("--- A. Bootstrap from migrations, then the HTTP suite ---");
    const mig = sh("npx", ["prisma", "migrate", "deploy"]);
    assert(mig.status === 0 && /privacy_consent/.test(mig.stdout), "The real migrations apply, including the privacy one");
    assert((await db.$queryRawUnsafe<any[]>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name IN ('privacyNoticeVersion','privacyAcceptedAt','guardianConsentAt','guardianConsentRecordedBy')`)).length === 4, "The four privacy columns exist");
    assert(sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" }).status === 0, "Course seeded");
    const adminEmail = `p43.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
    assert(sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P43 Admin", ADMIN_PASSWORD: adminPassword }).status === 0, "Admin bootstrapped");
    const env2 = { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, NODE_ENV: "development", AI_PROVIDER: "local" };
    const r = sh("npx", ["tsx", "scripts/test-phase43-privacy.ts"], env2);
    process.stdout.write(r.stdout.split("\n").filter((l) => /❌|RESULTS|crashed|Server up/.test(l)).join("\n") + "\n");
    if (r.status !== 0) console.error(r.stderr.slice(-600));
    assert(r.status === 0, "The privacy HTTP suite passes on PostgreSQL");

    console.log("\n--- B. Erasure leaves nothing behind ---");
    const port = 6900 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
    server = spawn("npx", ["tsx", "server.ts"], { env: { ...env, ...env2, PORT: String(port), AUTH_SECRET: crypto.randomBytes(16).toString("hex"), REQUIRE_PRIVACY_ACCEPTANCE: "true" }, stdio: "ignore", detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r2) => setTimeout(r2, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    const api = async (m: string, p: string, t?: string, b?: unknown) => {
      const res = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined });
      return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
    };
    const admin = (await api("POST", "/api/auth/login", undefined, { email: adminEmail, password: adminPassword })).json.token as string;
    await api("POST", "/api/auth/accept-privacy", admin);
    const mkStudent = async (tag: string) => { const x = await api("POST", "/api/auth/register", undefined, { name: `Pupil ${tag}`, email: `p43.${tag}.${run}@example.edu`, password: "Sturdy-Pass1", acceptPrivacy: true }); return { tok: x.json.token as string, id: x.json.user.id as string, email: `p43.${tag}.${run}@example.edu` }; };
    const A = await mkStudent("a"), B = await mkStudent("b");
    await api("POST", "/api/admin/users", admin, { name: "Teach", email: `p43.t.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER" });
    const T = (await api("POST", "/api/auth/login", undefined, { email: `p43.t.${run}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    await api("POST", "/api/auth/accept-privacy", T);
    const cls = (await api("POST", "/api/teacher/classes", T, { name: "Grade 7 - P43", gradeLevel: 7 })).json.data;
    for (const s of [A, B]) await api("POST", "/api/student/classes/join", s.tok, { code: cls.joinCode });
    const sets = (await api("GET", "/api/practice-sets", A.tok)).json.data as any[];
    for (const s of [A, B]) {
      const st = (await api("POST", "/api/practice/start", s.tok, { practiceSetId: sets[0].id })).json.data;
      const item = st.questions[0].question ?? st.questions[0];
      const t1 = await api("POST", "/api/ai/tutor", s.tok, { practiceSessionId: st.id, questionId: item.id ?? item.questionId, studentQuery: "I need a hint", helpLevel: 1 });
      assert(t1.status === 200, `Student ${s === A ? "A" : "B"} talks to the tutor (${t1.status})`);
    }
    // every table that has a foreign key to "User", read from the database itself
    const fks = await db.$queryRawUnsafe<Array<{ tbl: string; col: string }>>(`
      SELECT c.conrelid::regclass::text AS tbl, a.attname AS col FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.confrelid = '"User"'::regclass`);
    const countRefs = async (id: string) => { const out: Record<string, number> = {}; for (const f of fks) { const n = (await db.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS n FROM ${f.tbl} WHERE "${f.col}" = $1`, id))[0].n; if (n) out[`${f.tbl}.${f.col}`] = n; } return out; };
    const beforeA = await countRefs(A.id), beforeB = await countRefs(B.id);
    assert(Object.keys(beforeA).length >= 3, `Before erasure the student has rows in several tables (${Object.keys(beforeA).join(", ")})`);
    const er = await api("POST", `/api/admin/users/${A.id}/erase`, admin, { confirmEmail: A.email });
    assert(er.status === 200, "Erased through the admin route");
    const afterA = await countRefs(A.id);
    assert(Object.keys(afterA).length === 0, `No row in any of the ${fks.length} columns that point to a user still points to the erased student (${JSON.stringify(afterA)})`);
    assert((await db.user.count({ where: { id: A.id } })) === 0 && (await db.aITutorMessage.count({ where: { conversation: { studentId: A.id } } })) === 0, "The account and the tutor messages are gone");
    assert(JSON.stringify(await countRefs(B.id)) === JSON.stringify(beforeB), "The other student's rows are untouched");
    const leftover = await db.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS n FROM "AuditLog" WHERE detail::text ILIKE '%' || $1 || '%' OR "targetId" IS NULL AND false`, A.email);
    assert(leftover[0].n === 0, "No audit row contains the erased student's email");

    console.log("\n--- C. Export includes the tutor conversation ---");
    const exp = await api("GET", "/api/me/data-export", B.tok);
    const tc = exp.json.data?.tutorConversations ?? [];
    assert(tc.length >= 1 && tc[0].messages?.length >= 2 && exp.json.data.practiceSessions?.length >= 1, `Student B's export has their tutor conversation (${tc[0]?.messages?.length} messages) and practice session`);
    assert(!/passwordHash/.test(JSON.stringify(exp.json)), "...and no password hash");

    console.log("\n--- D. Retention ---");
    const conv = await db.aITutorConversation.findFirst({ where: { studentId: B.id } });
    await db.$executeRawUnsafe(`UPDATE "AITutorConversation" SET "updatedAt" = now() - interval '400 days' WHERE id = $1`, conv!.id);
    const recent = await db.aITutorConversation.create({ data: { studentId: B.id, title: "recent" } as any }).catch(() => null);
    const old = await db.auditLog.create({ data: { action: "test.old", ip: "10.1.2.3" } });
    const fresh = await db.auditLog.create({ data: { action: "test.new", ip: "10.9.9.9" } });
    await db.$executeRawUnsafe(`UPDATE "AuditLog" SET "createdAt" = now() - interval '200 days' WHERE id = $1`, old.id);
    const msgsBefore = await db.aITutorMessage.count({ where: { conversationId: conv!.id } });
    const dry = await runRetention(db, { apply: false });
    assert(dry.tutorConversations >= 1 && dry.tutorMessages === msgsBefore && dry.auditAddresses >= 1, `Dry run reports what it would do (${dry.tutorConversations} conversation(s), ${dry.tutorMessages} message(s), ${dry.auditAddresses} address(es))`);
    assert((await db.aITutorConversation.count({ where: { id: conv!.id } })) === 1 && (await db.auditLog.findUnique({ where: { id: old.id } }))?.ip === "10.1.2.3", "...and changed nothing");
    const done = await runRetention(db, { apply: true });
    assert(done.apply && (await db.aITutorConversation.count({ where: { id: conv!.id } })) === 0 && (await db.aITutorMessage.count({ where: { conversationId: conv!.id } })) === 0, "--apply deletes the old conversation and its messages");
    assert(recent === null || (await db.aITutorConversation.count({ where: { id: recent.id } })) === 1, "A recent conversation is kept");
    assert((await db.auditLog.findUnique({ where: { id: old.id } }))?.ip === null && (await db.auditLog.findUnique({ where: { id: old.id } }))?.action === "test.old", "The old audit entry stays but its address is cleared");
    assert((await db.auditLog.findUnique({ where: { id: fresh.id } }))?.ip === "10.9.9.9", "A recent address is kept");
    const again = await runRetention(db, { apply: true });
    assert(again.tutorConversations === 0 && again.auditAddresses === 0, "Running it again finds nothing (safe to schedule)");
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGKILL"); } catch { /* */ } }
    await db.$disconnect();
    const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
    await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`); await drop.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 43 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

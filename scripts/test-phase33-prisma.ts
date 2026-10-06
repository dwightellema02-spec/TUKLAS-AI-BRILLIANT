/**
 * Tuklas AI - Phase 33 on PostgreSQL. Creates a brand-new empty database, applies the schema, seeds ONLY the
 * curriculum (the production-safe path), bootstraps an admin, then runs the surface suite against it and
 * inspects the rows. Needs DATABASE_URL pointing at a PostgreSQL server where CREATE DATABASE is allowed.
 */
import crypto from "crypto";
import { spawn, spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) {
    console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script.");
    return;
  }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };

  const run = crypto.randomBytes(3).toString("hex");
  const dbName = `tuklas_p33_${run}`;
  const u = new URL(url);
  const adminUrl = new URL(url); adminUrl.pathname = "/postgres";
  u.pathname = `/${dbName}`;
  const freshUrl = u.toString();

  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await root.$disconnect();
  console.log(`Created empty database ${dbName}`);

  const env = { ...process.env, DATABASE_URL: freshUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) =>
    spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });

  console.log("--- A. Production-style bootstrap of an empty database ---");
  const push = sh("npx", ["prisma", "db", "push", "--skip-generate"]);
  assert(push.status === 0, "Schema applied to the empty database");
  const seed = sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" });
  assert(seed.status === 0, `Curriculum-only seed runs in production mode${seed.status === 0 ? "" : ": " + (seed.stderr || seed.stdout).slice(-300)}`);
  const adminEmail = `p33.admin.${run}@example.edu`;
  const adminPassword = `Boot-strap-${run}9`;
  const admin = sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P33 Admin", ADMIN_PASSWORD: adminPassword });
  assert(admin.status === 0, "Admin bootstrapped");

  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  assert((await db.user.count()) === 1, "The seeded database contains exactly one account (the admin): no demo users");
  assert((await db.lesson.count({ where: { status: "PUBLISHED" } })) >= 1 && (await db.skill.count()) >= 3, "...and the curriculum (published lesson + skills)");

  console.log("\n--- B. The assessment suite against PostgreSQL ---");
  const suite = sh("npx", ["tsx", "scripts/test-phase33-assessments.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, NODE_ENV: "development", AI_PROVIDER: "local" });
  process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|RESULTS|Server up|crashed/.test(l)).join("\n") + "\n");
  if (suite.status !== 0) console.error(suite.stderr.slice(-500));
  assert(suite.status === 0, "Assessment suite passes on PostgreSQL");

  console.log("\n--- C. What is actually in the database ---");
  const asm = await db.assessment.findMany({ include: { items: true, assignments: true, attempts: { include: { responses: true } } } });
  assert(asm.length >= 6, `Assessments are stored (${asm.length})`);
  assert(asm.every((a) => a.items.length >= 1 && !!a.authorId), "Every assessment has items and an author");
  assert(asm.every((a) => a.id.startsWith("asm_") && a.items.every((i) => i.id.startsWith("asmi_"))), "Ids are unique random ids (no timestamp collisions)");
  const pre = asm.find((a) => a.type === "PRE_TEST");
  assert(!!pre && pre.attempts.filter((t) => t.status === "GRADED").length === 2, "The pre-test has exactly one graded attempt per student who took it");
  const perStudent = new Map<string, number>();
  for (const a of asm.filter((x) => x.type === "PRE_TEST" || x.type === "POST_TEST")) for (const t of a.attempts) perStudent.set(`${a.id}:${t.studentId}`, (perStudent.get(`${a.id}:${t.studentId}`) ?? 0) + 1);
  assert(Array.from(perStudent.values()).every((n) => n === 1), "No student has two attempts on any pre/post test, even when started repeatedly");
  const graded = asm.flatMap((a) => a.attempts).filter((t) => t.status === "GRADED");
  assert(graded.length >= 5 && graded.every((t) => t.responses.length >= 1 && t.submittedAt !== null), `Graded attempts have their per-question responses and a submit time (${graded.length})`);
  assert(graded.every((t) => Math.abs(t.score - t.responses.reduce((s, r) => s + r.scoreAwarded, 0)) < 1e-9), "Each attempt's score equals the sum of its stored question scores");
  const stuck = asm.flatMap((a) => a.attempts).filter((t) => t.status === "SUBMITTED");
  assert(stuck.length === 0, "No attempt is stuck half-way between submitted and graded");
  const attemptsRace = asm.flatMap((a) => a.attempts).filter((t) => t.status === "GRADED");
  assert(new Set(attemptsRace.flatMap((t) => t.responses.map((r) => r.id))).size === attemptsRace.flatMap((t) => t.responses).length, "No response row was written twice");

  console.log("\n--- D. The time limit, with a back-dated start ---");
  const timed = asm.find((a) => a.type === "PRE_TEST");
  const open = await db.assessmentAttempt.findFirst({ where: { assessmentId: timed!.id, status: "GRADED" } });
  assert(!!open, "(setup) found an attempt to model");
  const sId = open!.studentId;
  // a fresh formative with a 1-minute limit, started 5 minutes ago
  const teacher = await db.user.findFirst({ where: { role: "TEACHER" } });
  const q = await db.question.findFirst({ where: { type: "NUMERIC_INPUT" } });
  const lateId = `asm_late_${run}`;
  await db.assessment.create({ data: { id: lateId, title: "Late quiz", type: "FORMATIVE", status: "PUBLISHED", timeLimitMinutes: 1, authorId: teacher!.id, items: { create: [{ id: `asmi_late_${run}`, questionId: q!.id, points: 1 }] } } });
  const cls = await db.classroomEnrollment.findFirst({ where: { studentId: sId } });
  await db.assessmentAssignment.create({ data: { assessmentId: lateId, classroomId: cls!.classroomId } });
  await db.assessmentAttempt.create({ data: { id: `att_late_${run}`, assessmentId: lateId, studentId: sId, assessmentType: "FORMATIVE", status: "IN_PROGRESS", maxScore: 1, startedAt: new Date(Date.now() - 5 * 60_000) } });
  // log in as that student through the API
  const stu = await db.user.findUnique({ where: { id: sId } });
  const port = 5200 + Math.floor(Math.random() * 90);
  const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
  try {
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch { /* */ } }
    // a seeded password hash is not known: set a known one through the admin API instead
    const adminTok = (await (await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: adminEmail, password: adminPassword }) })).json()).token;
    await fetch(`http://127.0.0.1:${port}/api/admin/users/${sId}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminTok}` }, body: JSON.stringify({ temporaryPassword: "Fresh-Pass-77x" }) });
    const stuTok = (await (await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: stu!.email, password: "Fresh-Pass-77x" }) })).json()).token;
    const list = await (await fetch(`http://127.0.0.1:${port}/api/student/assessments`, { headers: { Authorization: `Bearer ${stuTok}` } })).json();
    const row = list.data.find((x: any) => x.id === lateId);
    assert(row?.progress === "IN_PROGRESS", "The back-dated attempt is listed as in progress");
    const resumed = await (await fetch(`http://127.0.0.1:${port}/api/student/assessments/${lateId}/start`, { method: "POST", headers: { Authorization: `Bearer ${stuTok}` } })).json();
    assert(resumed.data.resumed === true && resumed.data.secondsLeft === 0, `Resuming reports 0 seconds left (${resumed.data?.secondsLeft})`);
    const sub = await (await fetch(`http://127.0.0.1:${port}/api/student/assessments/attempts/att_late_${run}/submit`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${stuTok}` }, body: JSON.stringify({ responses: [] }) })).json();
    assert(sub.data?.timedOut === true, "A submission after the limit (plus grace) is still graded and flagged as timed out");
    const row2 = await db.assessmentAttempt.findUnique({ where: { id: `att_late_${run}` } });
    assert(row2?.status === "GRADED" && JSON.parse(row2.metadata ?? "{}").timedOut === true, "...and the flag is stored with the attempt");
  } finally { try { process.kill(-srv.pid!, "SIGTERM"); } catch { /* gone */ } }

  await db.$disconnect();
  const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await drop.$disconnect();

  console.log(`\nPOSTGRES PHASE 33 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

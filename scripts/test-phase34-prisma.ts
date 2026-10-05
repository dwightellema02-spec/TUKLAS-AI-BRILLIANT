/**
 * Tuklas AI - Phase 34 on PostgreSQL. Creates a brand-new empty database, applies the schema, seeds ONLY the
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
  const dbName = `tuklas_p34_${run}`;
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
  const adminEmail = `p34.admin.${run}@example.edu`;
  const adminPassword = `Boot-strap-${run}9`;
  const admin = sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P34 Admin", ADMIN_PASSWORD: adminPassword });
  assert(admin.status === 0, "Admin bootstrapped");

  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  assert((await db.user.count()) === 1, "The seeded database contains exactly one account (the admin): no demo users");
  assert((await db.lesson.count({ where: { status: "PUBLISHED" } })) >= 1 && (await db.skill.count()) >= 3, "...and the curriculum (published lesson + skills)");

  console.log("\n--- B. The classroom journey (real browser) against PostgreSQL ---");
  const port = 5600 + Math.floor(Math.random() * 90);
  const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
  try {
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) break; } catch { /* */ } }
    const j = spawnSync("node", ["scripts/test-phase34-journey.mjs"], { env: { ...env, BASE_URL: `http://127.0.0.1:${port}`, ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024, timeout: 400_000 });
    process.stdout.write((j.stdout || "").split("\n").filter((l) => /^FAIL|COMPLETE|CHECK\(S\)/.test(l)).join("\n") + "\n");
    if (j.status !== 0) console.error((j.stderr || "").slice(-600));
    assert(j.status === 0, "The whole teacher + student journey passes on PostgreSQL");
    const passes = (j.stdout || "").split("\n").filter((l) => l.startsWith("PASS")).length;
    assert(passes >= 25, `...with ${passes} passing checks`);
  } finally { try { process.kill(-srv.pid!, "SIGTERM"); } catch { /* gone */ } }

  console.log("\n--- C. What the journey left in the database ---");
  assert((await db.user.count({ where: { role: "TEACHER" } })) === 1 && (await db.user.count({ where: { role: "STUDENT" } })) === 1, "One teacher and one student account (the ones the journey made)");
  assert((await db.classroom.count()) === 1 && (await db.classroomEnrollment.count()) === 1, "One class with one enrolled student");
  assert((await db.assessmentAttempt.count({ where: { status: "GRADED" } })) === 2, "Two graded assessment attempts (pre-test and post-test)");
  assert((await db.practiceSession.count({ where: { status: "COMPLETED" } })) >= 1, "A completed practice session");
  assert((await db.aITutorMessage.count({ where: { role: "STUDENT" } })) >= 2, "The student's tutor messages are stored");
  assert((await db.questionAttempt.count()) >= 8, "Question attempts from practice and assessments are stored");

  await db.$disconnect();
  const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await drop.$disconnect();

  console.log(`\nPOSTGRES PHASE 34 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

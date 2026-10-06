/**
 * Tuklas AI - Phase 39 on PostgreSQL. Brand-new database, curriculum-only seed (real Term 1 course), admin bootstrap, then the lesson-access
 * suite and browser check against it, and a look at the rows. Needs DATABASE_URL pointing at a PostgreSQL server where CREATE DATABASE is allowed.
 */
import crypto from "crypto";
import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
  const run = crypto.randomBytes(3).toString("hex");
  const dbName = `tuklas_p39_${run}`;
  const u = new URL(url); const adminUrl = new URL(url); adminUrl.pathname = "/postgres"; u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`); await root.$disconnect();
  const env = { ...process.env, DATABASE_URL: freshUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) => spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  try {
    console.log("--- A. Bootstrap ---");
    assert(sh("npx", ["prisma", "db", "push", "--skip-generate"]).status === 0, "Schema applied (includes the LessonUnlock table)");
    assert(sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" }).status === 0, "Curriculum-only seed");
    const adminEmail = `p39.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
    assert(sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P39 Admin", ADMIN_PASSWORD: adminPassword }).status === 0, "Admin bootstrapped");

    console.log("\n--- B. Suite and browser check on PostgreSQL ---");
    const env2 = { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, NODE_ENV: "development", AI_PROVIDER: "local" };
    const suite = sh("npx", ["tsx", "scripts/test-phase39-unlocks.ts"], env2);
    process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|RESULTS|crashed|Server up/.test(l)).join("\n") + "\n");
    if (suite.status !== 0) console.error(suite.stderr.slice(-500));
    assert(suite.status === 0, "Lesson-access suite passes on PostgreSQL");
    const br = sh("node", ["scripts/test-phase39-browser.mjs"], env2);
    process.stdout.write((br.stdout || "").split("\n").filter((l) => /^FAIL|ALL BROWSER|CHECK\(S\)/.test(l)).join("\n") + "\n");
    if (br.status !== 0) console.error((br.stderr || "").slice(-400));
    assert(br.status === 0, "Teacher panel / student view browser check passes on PostgreSQL");

    console.log("\n--- C. What is in the database ---");
    const rows = await db.lessonUnlock.findMany();
    assert(rows.length > 0, `Openings were stored (${rows.length})`);
    assert(rows.every((r) => r.studentId === "" || r.studentId.length > 10), "Each opening is either class-wide ('') or names one student");
    const dup = await db.$queryRawUnsafe<Array<{ n: bigint }>>('SELECT count(*)::bigint AS n FROM (SELECT 1 FROM "LessonUnlock" GROUP BY "classroomId","lessonId","studentId" HAVING count(*) > 1) d');
    assert(Number(dup[0].n) === 0, "No lesson is opened twice for the same class and student (unique key)");
    const cid = rows[0].classroomId;
    const before = await db.lessonUnlock.count({ where: { classroomId: cid } });
    await db.classroom.delete({ where: { id: cid } });
    assert(before > 0 && (await db.lessonUnlock.count({ where: { classroomId: cid } })) === 0, "Deleting a class removes its openings");
    let dupBlocked = false;
    try {
      const k = await db.classroom.findFirst();
      if (k) { const lessonId = (await db.lesson.findFirst())!.id; await db.lessonUnlock.create({ data: { classroomId: k.id, lessonId, studentId: "", createdById: "x" } }); await db.lessonUnlock.create({ data: { classroomId: k.id, lessonId, studentId: "", createdById: "x" } }); } else dupBlocked = true;
    } catch { dupBlocked = true; }
    assert(dupBlocked, "The database itself refuses a duplicate opening");
  } finally {
    await db.$disconnect();
    const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
    await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`); await drop.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 39 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

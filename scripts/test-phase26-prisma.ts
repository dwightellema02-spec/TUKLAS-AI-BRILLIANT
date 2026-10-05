/**
 * Tuklas AI - Phase 26 on PostgreSQL. Creates a brand-new empty database, applies the schema, seeds ONLY the
 * curriculum (the production-safe path), bootstraps an admin, then runs the progress suite against it and
 * inspects the rows. Needs DATABASE_URL pointing at a PostgreSQL server where CREATE DATABASE is allowed.
 */
import crypto from "crypto";
import { spawnSync } from "child_process";
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
  const dbName = `tuklas_p26_${run}`;
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
  const adminEmail = `p26.admin.${run}@example.edu`;
  const adminPassword = `Boot-strap-${run}9`;
  const admin = sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P26 Admin", ADMIN_PASSWORD: adminPassword });
  assert(admin.status === 0, "Admin bootstrapped");

  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  assert((await db.user.count()) === 1, "The seeded database contains exactly one account (the admin): no demo users");
  assert((await db.lesson.count({ where: { status: "PUBLISHED" } })) >= 1 && (await db.skill.count()) >= 3, "...and the curriculum (published lesson + skills)");

  console.log("\n--- B. The student progress suite against PostgreSQL (with a server restart) ---");
  const suite = sh("npx", ["tsx", "scripts/test-phase26-progress.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, RESTART_CHECK: "1", NODE_ENV: "development" });
  process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|RESULTS|Server up|crashed/.test(l)).join("\n") + "\n");
  if (suite.status !== 0) console.error(suite.stderr.slice(-500));
  assert(suite.status === 0, "Progress suite passes on PostgreSQL");

  console.log("\n--- C. What is actually in the database ---");
  const rows = await db.studentProgress.findMany();
  assert(rows.length >= 2, `Progress is stored as rows (${rows.length})`);
  const keys = rows.filter((r) => r.lessonId && !r.skillId).map((r) => `${r.userId}:${r.lessonId}`);
  assert(new Set(keys).size === keys.length, "At most one lesson-progress row per student per lesson, despite 8 concurrent updates");
  assert(rows.every((r) => r.understandingScore === 0 && r.accuracyScore === 0 && r.compositeScore === 0), "Progress rows carry no invented quality scores");
  const completed = rows.filter((r) => r.status === "COMPLETED");
  assert(completed.length > 0 && completed.every((r) => r.progressPercentage === 100 && r.completedAt), "Completed rows are 100% with a completion time");
  const lessons = await db.lesson.findMany({ where: { title: { startsWith: "P26 Lesson" } }, orderBy: { sequenceOrder: "asc" } });
  assert(lessons.length === 2 && lessons[0].sequenceOrder !== lessons[1].sequenceOrder, "New lessons get distinct sequence numbers from the database (not the in-memory count)");
  assert((await db.user.count({ where: { email: { endsWith: "@tuklas.ai" } } })) === 0, "No demo (@tuklas.ai) account was ever created");

  await db.$disconnect();
  const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await drop.$disconnect();

  console.log(`\nPOSTGRES PHASE 26 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

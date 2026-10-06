/**
 * Tuklas AI - Phase 36 on PostgreSQL. Creates a brand-new empty database, applies the schema, seeds ONLY the
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
  const dbName = `tuklas_p36_${run}`;
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
  const adminEmail = `p36.admin.${run}@example.edu`;
  const adminPassword = `Boot-strap-${run}9`;
  const admin = sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P36 Admin", ADMIN_PASSWORD: adminPassword });
  assert(admin.status === 0, "Admin bootstrapped");

  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  assert((await db.user.count()) === 1, "The seeded database contains exactly one account (the admin): no demo users");
  assert((await db.lesson.count({ where: { status: "PUBLISHED" } })) >= 1 && (await db.skill.count()) >= 3, "...and the curriculum (published lesson + skills)");

  console.log("\n--- B. Analytics suite and browser check against PostgreSQL ---");
  const suite = sh("npx", ["tsx", "scripts/test-phase36-analytics.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, NODE_ENV: "development", AI_PROVIDER: "local" });
  process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|RESULTS|crashed/.test(l)).join("\n") + "\n");
  if (suite.status !== 0) console.error(suite.stderr.slice(-500));
  assert(suite.status === 0, "Analytics suite passes on PostgreSQL");
  const br = sh("node", ["scripts/test-phase36-browser.mjs"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, AI_PROVIDER: "local" });
  process.stdout.write((br.stdout || "").split("\n").filter((l) => /^FAIL|ALL BROWSER|CHECK\(S\)/.test(l)).join("\n") + "\n");
  assert(br.status === 0, "Dashboard browser check passes on PostgreSQL");

  console.log("\n--- C. What is actually in the database ---");
  const sessions = await db.practiceSession.findMany({ where: { status: "COMPLETED" } });
  assert(sessions.length >= 10, `Completed practice sessions exist (${sessions.length})`);
  let mismatched = 0;
  for (const ps of sessions) {
    const rows = await db.questionAttempt.findMany({ where: { practiceSessionId: ps.id, isCorrect: true }, select: { questionId: true } });
    if (new Set(rows.map((r) => r.questionId)).size !== ps.correctAnswers) mismatched++;
  }
  assert(mismatched === 0, `Every session's stored correct-answer count equals its distinct correct attempts (this was wrong before: ${mismatched} mismatches)`);
  assert(sessions.some((s) => s.correctAnswers >= 4), "A session scored above 1 correct answer is stored as such");
  assert(sessions.every((s) => Math.abs(s.score - Math.round((s.correctAnswers / s.totalQuestions) * 1000) / 10) < 0.11), "Stored scores match correct/total");

  await db.$disconnect();
  const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await drop.$disconnect();

  console.log(`\nPOSTGRES PHASE 36 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

/**
 * Tuklas AI - Phase 51 on PostgreSQL. Creates a brand-new empty database, applies the schema, seeds ONLY the curriculum,
 * bootstraps an admin, runs the subject-authorization suite against it, then inspects the rows. Needs DATABASE_URL pointing at a
 * PostgreSQL server where CREATE DATABASE is allowed.
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
  const dbName = `tuklas_p51_${run}`;
  const u = new URL(url);
  const adminUrl = new URL(url); adminUrl.pathname = "/postgres";
  u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  await root.$disconnect();
  console.log(`Created empty database ${dbName}`);
  const env = { ...process.env, DATABASE_URL: freshUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) => spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });

  console.log("--- A. Empty database: migrations (not db push) then curriculum seed ---");
  const mig = sh("npx", ["tsx", "scripts/db-migrate.ts"]);
  assert(mig.status === 0 && /teacher_subject_assignment/.test(mig.stdout + mig.stderr), "all migrations, including the Phase 51 one, apply to an empty database");
  const seed = sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" });
  assert(seed.status === 0, "curriculum-only seed runs");
  const adminEmail = `p51.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
  assert(sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P51 Admin", ADMIN_PASSWORD: adminPassword }).status === 0, "admin bootstrapped");
  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  assert((await db.teacherSubjectAssignment.count()) === 0, "nobody is authorized in a fresh database (deny by default)");

  console.log("\n--- B. The subject-authorization suite against PostgreSQL ---");
  const suite = sh("npx", ["tsx", "scripts/test-phase51-subject-authorization.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, NODE_ENV: "development" });
  process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|Phase 51 subject|Server up|crashed/.test(l)).join("\n") + "\n");
  if (suite.status !== 0) console.error(suite.stderr.slice(-600));
  assert(suite.status === 0, "suite passes on PostgreSQL");

  console.log("\n--- C. What is actually in the database ---");
  const active = await db.teacherSubjectAssignment.count({ where: { revokedAt: null } });
  assert(active >= 3, `current assignments recorded (${active})`);
  const audits = await db.auditLog.findMany({ where: { action: { startsWith: "admin.subject_authorization" } } });
  assert(audits.some((a) => a.action.endsWith(".grant")) && audits.some((a) => a.action.endsWith(".revoke")), "grants and revocations are in the audit log");
  assert((await db.auditLog.count({ where: { action: "lesson.authoring_denied" } })) > 10, "refused attempts are in the audit log");
  const bad = await db.lesson.count({ where: { title: { contains: "hijacked" } } });
  assert(bad === 0, "no lesson carries text written by an unauthorized teacher");
  await db.$disconnect();
  const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`); // only the throw-away database this script created
  await drop.$disconnect();
  console.log(`\nPHASE 51 POSTGRESQL: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

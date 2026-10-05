/**
 * Tuklas AI - Phase 37 on PostgreSQL. Creates a brand-new empty database, applies the schema, seeds ONLY the
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
  const dbName = `tuklas_p37_${run}`;
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
  const adminEmail = `p37.admin.${run}@example.edu`;
  const adminPassword = `Boot-strap-${run}9`;
  const admin = sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P37 Admin", ADMIN_PASSWORD: adminPassword });
  assert(admin.status === 0, "Admin bootstrapped");

  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  assert((await db.user.count()) === 1, "The seeded database contains exactly one account (the admin): no demo users");
  assert((await db.lesson.count({ where: { status: "PUBLISHED" } })) >= 1 && (await db.skill.count()) >= 3, "...and the curriculum (published lesson + skills)");
  assert((await db.lessonSkill.count()) >= 3, "...and the seeded lesson is linked to its skills (it was not: nothing done in it could count towards a skill)");
  const linksBefore = await db.lessonSkill.count();
  const seedAgain = sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" });
  assert(seedAgain.status === 0 && (await db.lessonSkill.count()) === linksBefore, "Running the seed again changes nothing (safe to repeat on every container start)");

  console.log("\n--- B. Skill-linking suite and browser check against PostgreSQL ---");
  const env2 = { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, NODE_ENV: "development", AI_PROVIDER: "local" };
  const suite = sh("npx", ["tsx", "scripts/test-phase37-skills.ts"], env2);
  process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|RESULTS|crashed/.test(l)).join("\n") + "\n");
  if (suite.status !== 0) console.error(suite.stderr.slice(-500));
  assert(suite.status === 0, "Skill-linking suite passes on PostgreSQL");
  const br = sh("node", ["scripts/test-phase37-browser.mjs"], env2);
  process.stdout.write((br.stdout || "").split("\n").filter((l) => /^FAIL|ALL BROWSER|CHECK\(S\)/.test(l)).join("\n") + "\n");
  if (br.status !== 0) console.error((br.stderr || "").slice(-400));
  assert(br.status === 0, "Editor / question bank browser check passes on PostgreSQL");

  console.log("\n--- C. What is actually in the database ---");
  const qs = await db.question.findMany({ select: { prompt: true, skillId: true, lessonId: true } });
  assert(qs.length >= 8, `Questions were stored (${qs.length})`);
  const orphanSkill = await db.$queryRawUnsafe<Array<{ n: bigint }>>('SELECT count(*)::bigint AS n FROM "Question" q WHERE q."skillId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Skill" s WHERE s.id = q."skillId")');
  assert(Number(orphanSkill[0].n) === 0, "No question points to a skill that does not exist");
  const inherited = qs.find((q) => q.prompt.startsWith("P37 lesson"));
  assert(!!inherited?.skillId && !!inherited?.lessonId, "The question made from a lesson in the editor stored both the lesson and its skill");
  assert(qs.some((q) => q.prompt.startsWith("P37 browser") && q.skillId === null), "A question deliberately saved without a skill is stored as such (and flagged in the question bank)");

  await db.$disconnect();
  const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await drop.$disconnect();

  console.log(`\nPOSTGRES PHASE 37 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

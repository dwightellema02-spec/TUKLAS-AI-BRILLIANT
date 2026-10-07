/**
 * Tuklas AI - Phase 45 on PostgreSQL: fresh database from the real migrations + the real Term 1 course, then the import suite, then a look at
 * the rows (drafts really are drafts, owned by the importing teacher, with their sections; failed uploads left nothing behind).
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
  const dbName = `tuklas_p45_${run}`;
  const u = new URL(url); const adminUrl = new URL(url); adminUrl.pathname = "/postgres"; u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`); await root.$disconnect();
  const env = { ...process.env, DATABASE_URL: freshUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) => spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  try {
    assert(sh("npx", ["prisma", "migrate", "deploy"]).status === 0, "Schema built from the real migrations");
    assert(sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" }).status === 0, "Real Term 1 course seeded");
    const adminEmail = `p45.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
    assert(sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P45 Admin", ADMIN_PASSWORD: adminPassword }).status === 0, "Admin bootstrapped");
    const lessonsBefore = await db.lesson.count();
    const r = sh("npx", ["tsx", "scripts/test-phase45-import.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, NODE_ENV: "development", AI_PROVIDER: "local" });
    process.stdout.write(r.stdout.split("\n").filter((l) => /❌|RESULTS|crashed/.test(l)).join("\n") + "\n");
    if (r.status !== 0) console.error(r.stderr.slice(-600));
    assert(r.status === 0, "The import suite passes on PostgreSQL");

    const imported = await db.lesson.findMany({ where: { id: { notIn: [] } }, orderBy: { createdAt: "desc" }, take: 100, include: { contentBlocks: true } });
    const fresh = imported.slice(0, imported.length - lessonsBefore);
    assert(fresh.length >= 5 && fresh.every((l) => l.status === "DRAFT" && !!l.authorId), `${fresh.length} new lessons, every one a DRAFT with an author`);
    assert(fresh.every((l) => l.contentBlocks.length > 0), "None is empty: each has its sections");
    assert((await db.lessonContentBlock.count({ where: { content: { contains: "ZZ-ANSWER-KEY-7491" } } })) === 0, "The answer-key text is in no stored section");
    assert((await db.lessonContentBlock.count({ where: { lesson: { status: "PUBLISHED" }, content: { contains: "Replace this text" } } })) === 0, "No published lesson has template text");
    const orphan = await db.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS n FROM "LessonContentBlock" b LEFT JOIN "Lesson" l ON l.id = b."lessonId" WHERE l.id IS NULL`);
    assert(orphan[0].n === 0, "No section without a lesson");
    assert((await db.auditLog.count({ where: { action: "lesson.import_draft" } })) >= 4, "The imports are in the audit log");
    const chunks = await db.resourceChunk.findMany({ where: { text: { contains: "ZZ-ANSWER-KEY-7491" } } });
    assert(chunks.length >= 1 && chunks.every((c) => c.isAnswerKey), `The attached document's answer-key text is stored only in chunks flagged as answer keys (${chunks.length}), which are never retrieved for students`);
    assert((await db.lessonResource.count({ where: { addedBy: { not: null }, extractionStatus: "EXTRACTED" } })) >= 1, "An attached document is stored with its extraction result");
  } finally {
    await db.$disconnect();
    const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
    await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`); await drop.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 45 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

/**
 * Tuklas AI - Phase 42: backup and restore. Needs DATABASE_URL (PostgreSQL, CREATE DATABASE allowed) and pg_dump / pg_restore.
 * Builds a database with real content (curriculum, accounts, a class, progress), backs it up, destroys data, restores, and compares EVERY table.
 */
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
  const run = crypto.randomBytes(3).toString("hex");
  const adminUrl = new URL(url); adminUrl.pathname = "/postgres";
  const dbUrl = (n: string) => { const u = new URL(url); u.pathname = `/${n}`; return u.toString(); };
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  const names: string[] = [];
  const mk = async (tag: string) => { const n = `tuklas_p42b_${tag}_${run}`; names.push(n); await root.$executeRawUnsafe(`CREATE DATABASE "${n}"`); return n; };
  const sh = (cmd: string, args: string[], dbName: string, extra: Record<string, string> = {}) => spawnSync(cmd, args, { encoding: "utf-8", env: { ...process.env, DATABASE_URL: dbUrl(dbName), ...extra }, maxBuffer: 50 * 1024 * 1024 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p42b-"));
  const counts = async (dbName: string) => {
    const c = new PrismaClient({ datasources: { db: { url: dbUrl(dbName) } } });
    try {
      const tables = await c.$queryRawUnsafe<Array<{ t: string }>>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`);
      const out: Record<string, number> = {};
      for (const { t } of tables) out[t] = (await c.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS n FROM "${t}"`))[0].n;
      return out;
    } finally { await c.$disconnect(); }
  };
  try {
    const src = await mk("src");
    assert(sh("npx", ["tsx", "scripts/db-migrate.ts"], src).status === 0, "(setup) migrated");
    assert(sh("npx", ["tsx", "prisma/seed.ts"], src, { SEED_CURRICULUM_ONLY: "true", NODE_ENV: "production" }).status === 0, "(setup) real curriculum seeded");
    const c = new PrismaClient({ datasources: { db: { url: dbUrl(src) } } });
    for (let i = 0; i < 6; i++) await c.user.create({ data: { email: `s${i}.${run}@example.edu`, name: `Student ${i}`, passwordHash: "x", role: i === 0 ? "TEACHER" : "STUDENT" } });
    const before = await counts(src);
    await c.$disconnect();
    assert(before.User === 6 && before.Lesson >= 7 && before.Question >= 180, `(setup) content to protect: ${before.User} users, ${before.Lesson} lessons, ${before.Question} questions`);

    console.log("--- A. Backup ---");
    const bdir = path.join(dir, "backups");
    const b1 = sh("sh", ["scripts/backup-db.sh"], src, { BACKUP_DIR: bdir });
    assert(b1.status === 0 && /backup written/.test(b1.stdout), "A backup is written");
    const files = fs.readdirSync(bdir).filter((f) => f.endsWith(".dump"));
    assert(files.length === 1 && !fs.readdirSync(bdir).some((f) => f.endsWith(".partial")), "One finished file, no partial leftovers");
    assert((fs.statSync(path.join(bdir, files[0])).mode & 0o077) === 0 && (fs.statSync(bdir).mode & 0o077) === 0, "The file and folder are private to the owner (they hold students' data)");
    const bad = sh("sh", ["scripts/backup-db.sh"], src, { BACKUP_DIR: bdir, DATABASE_URL: dbUrl("no_such_db_" + run) });
    assert(bad.status !== 0 && fs.readdirSync(bdir).length === 1, "A backup of an unreachable database fails and leaves no empty file behind");
    for (let i = 0; i < 4; i++) { await new Promise((r) => setTimeout(r, 1100)); sh("sh", ["scripts/backup-db.sh"], src, { BACKUP_DIR: bdir, BACKUP_KEEP: "3" }); }
    assert(fs.readdirSync(bdir).filter((f) => f.endsWith(".dump")).length === 3, "Only the newest 3 are kept (rotation)");
    const newest = fs.readdirSync(bdir).filter((f) => f.endsWith(".dump")).sort().pop()!;

    console.log("\n--- B. Disaster and restore ---");
    const c2 = new PrismaClient({ datasources: { db: { url: dbUrl(src) } } });
    await c2.$executeRawUnsafe(`TRUNCATE TABLE "User" CASCADE`);
    const wrecked = await counts(src);
    await c2.$disconnect();
    assert(wrecked.User === 0 && wrecked.Lesson === 0, "(setup) the original database is wrecked (users and everything that depends on them gone)");
    const fresh = await mk("restored");
    const dry = sh("sh", ["scripts/restore-db.sh", path.join(bdir, newest)], fresh);
    assert(dry.status === 2 && /RESTORE_CONFIRM=yes/.test(dry.stdout), "Without confirmation it only checks the file and says what it would do");
    assert((await counts(fresh)).User === undefined, "...and changed nothing");
    const junk = path.join(dir, "junk.dump"); fs.writeFileSync(junk, "not a backup");
    assert(sh("sh", ["scripts/restore-db.sh", junk], fresh, { RESTORE_CONFIRM: "yes" }).status === 1, "A file that is not a backup is refused");
    const rs = sh("sh", ["scripts/restore-db.sh", path.join(bdir, newest)], fresh, { RESTORE_CONFIRM: "yes" });
    assert(rs.status === 0, `Restore into a new empty database succeeds${rs.status === 0 ? "" : ": " + rs.stderr.slice(-300)}`);
    const after = await counts(fresh);
    const diff = Object.keys(before).filter((t) => before[t] !== after[t]);
    assert(Object.keys(before).length > 30 && diff.length === 0, `Every one of ${Object.keys(before).length} tables has the same number of rows as before${diff.length ? " (differs: " + diff.join(", ") + ")" : ""}`);
    const mig = sh("npx", ["tsx", "scripts/db-migrate.ts"], fresh);
    assert(mig.status === 0, "The restored database is under migrations (a deploy against it is a no-op)");
    const c3 = new PrismaClient({ datasources: { db: { url: dbUrl(fresh) } } });
    const u0 = await c3.user.findFirst({ where: { email: `s1.${run}@example.edu` } });
    assert(u0?.name === "Student 1", "A restored row reads back correctly");
    await c3.$disconnect();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    for (const n of names) await root.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${n}" WITH (FORCE)`).catch(() => {});
    await root.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 42 BACKUP RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

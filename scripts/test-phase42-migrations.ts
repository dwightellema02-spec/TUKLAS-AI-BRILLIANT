/**
 * Tuklas AI - Phase 42: schema deployment through migrations. Needs DATABASE_URL (PostgreSQL, CREATE DATABASE allowed).
 *   - a fresh database built by `db-migrate` is IDENTICAL to what schema.prisma describes
 *   - a database made by the old `db push` is adopted without touching its data
 *   - a legacy database that does not match is refused and left alone
 *   - a later migration applies without losing data; running twice is harmless
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
  const mk = async (tag: string) => { const n = `tuklas_p42_${tag}_${run}`; names.push(n); await root.$executeRawUnsafe(`CREATE DATABASE "${n}"`); return n; };
  const sh = (args: string[], dbName: string, extra: Record<string, string> = {}) => spawnSync("npx", args, { encoding: "utf-8", env: { ...process.env, DATABASE_URL: dbUrl(dbName), ...extra }, maxBuffer: 20 * 1024 * 1024 });
  const migrate = (dbName: string, extra: Record<string, string> = {}) => sh(["tsx", "scripts/db-migrate.ts"], dbName, extra);
  const q = async (dbName: string, sql: string) => { const c = new PrismaClient({ datasources: { db: { url: dbUrl(dbName) } } }); try { return await c.$queryRawUnsafe<any[]>(sql); } finally { await c.$disconnect(); } };
  try {
    console.log("--- A. A fresh database ---");
    const a = await mk("fresh");
    const r1 = migrate(a);
    assert(r1.status === 0 && /up to date/.test(r1.stdout), "db-migrate builds an empty database");
    const drift = sh(["prisma", "migrate", "diff", "--from-url", dbUrl(a), "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"], a);
    assert(drift.status === 0, `What the migrations build is exactly what schema.prisma describes (diff exit ${drift.status})`);
    const hist = await q(a, `SELECT migration_name, finished_at IS NOT NULL AS done FROM _prisma_migrations`);
    assert(hist.length >= 1 && hist.every((h) => h.done), `History recorded (${hist.map((h) => h.migration_name).join(", ")})`);
    assert(migrate(a).status === 0, "Running it again is harmless");

    console.log("\n--- B. A database made by the old `db push` ---");
    const b = await mk("legacy");
    assert(sh(["prisma", "db", "push", "--skip-generate"], b).status === 0, "(setup) a database created the old way");
    await q(b, `INSERT INTO "User" (id, email, name, "passwordHash", role, "updatedAt") VALUES ('u-legacy', 'legacy@example.edu', 'Legacy', 'x', 'STUDENT', now())`);
    const r2 = migrate(b);
    assert(r2.status === 0 && /adopted/.test(r2.stdout), "It is adopted");
    assert((await q(b, `SELECT count(*)::int AS n FROM "User" WHERE email = 'legacy@example.edu'`))[0].n === 1, "Its data is untouched");
    const folders = fs.readdirSync("prisma/migrations", { withFileTypes: true }).filter((e) => e.isDirectory()).length;
    assert((await q(b, `SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL`))[0].n === folders, `Every migration is now recorded as applied (${folders}), none was run against the existing tables`);

    console.log("\n--- C. A legacy database that does not match is refused and left alone ---");
    const c = await mk("drift");
    sh(["prisma", "db", "push", "--skip-generate"], c);
    await q(c, `ALTER TABLE "Skill" DROP COLUMN "createdById"`);
    await q(c, `INSERT INTO "User" (id, email, name, "passwordHash", role, "updatedAt") VALUES ('u-d', 'd@example.edu', 'D', 'x', 'STUDENT', now())`);
    const r3 = migrate(c);
    assert(r3.status === 3 && /STOPPED/.test(r3.stderr), `Refused with a clear message (exit ${r3.status})`);
    assert((await q(c, `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = '_prisma_migrations'`))[0].n === 0, "No history was written");
    assert((await q(c, `SELECT count(*)::int AS n FROM "User"`))[0].n === 1, "No data was touched");

    console.log("\n--- D. A later migration keeps the data ---");
    const d = await mk("later");
    migrate(d);
    await q(d, `INSERT INTO "User" (id, email, name, "passwordHash", role, "updatedAt") VALUES ('u-later', 'later@example.edu', 'Later', 'x', 'STUDENT', now())`);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "p42-"));
    fs.cpSync("prisma", path.join(tmp, "prisma"), { recursive: true });
    const mdir = path.join(tmp, "prisma", "migrations", "20261007000000_add_note");
    fs.mkdirSync(mdir);
    fs.writeFileSync(mdir + "/migration.sql", `ALTER TABLE "User" ADD COLUMN "p42Note" TEXT;\n`);
    const r4 = migrate(d, { PRISMA_SCHEMA_PATH: path.join(tmp, "prisma", "schema.prisma") });
    assert(r4.status === 0, "A new migration applies");
    assert((await q(d, `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'p42Note'`))[0].n === 1, "...the new column exists");
    assert((await q(d, `SELECT count(*)::int AS n FROM "User" WHERE email = 'later@example.edu'`))[0].n === 1, "...and the existing rows are intact");
    assert((await q(d, `SELECT count(*)::int AS n FROM _prisma_migrations`))[0].n === fs.readdirSync("prisma/migrations", { withFileTypes: true }).filter((e) => e.isDirectory()).length + 1, "...and it is recorded");
    const bad = path.join(tmp, "prisma", "migrations", "20261008000000_broken");
    fs.mkdirSync(bad); fs.writeFileSync(bad + "/migration.sql", `ALTER TABLE "User" ADD COLUMN "ok1" TEXT;\nALTER TABLE "NoSuchTable" ADD COLUMN "x" TEXT;\n`);
    const r5 = migrate(d, { PRISMA_SCHEMA_PATH: path.join(tmp, "prisma", "schema.prisma") });
    assert(r5.status !== 0, "A broken migration fails loudly");
    assert((await q(d, `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'ok1'`))[0].n === 0, "...and its earlier statement was rolled back (nothing half-applied)");
    fs.rmSync(tmp, { recursive: true, force: true });
  } finally {
    for (const n of names) await root.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${n}" WITH (FORCE)`).catch(() => {});
    await root.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 42 MIGRATIONS RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

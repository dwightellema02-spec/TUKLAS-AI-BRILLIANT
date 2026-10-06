/**
 * Applies the database schema safely at deploy time (Phase 42). Replaces `prisma db push`, which has no history, cannot be reviewed and
 * can drop data when the schema changes.
 *
 *  - empty database                      -> `prisma migrate deploy` (builds everything from the migrations)
 *  - database made by the old `db push`  -> if it matches the baseline schema, record the baseline as applied, then deploy; if it does NOT
 *                                           match, stop and change nothing (a person decides: nothing here guesses)
 *  - database already under migrations   -> `prisma migrate deploy` (applies only what is new; never destructive on its own)
 *
 * Env: DATABASE_URL (required), PRISMA_SCHEMA_PATH (default prisma/schema.prisma).
 */
import { spawnSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const BASELINE = "20261006000000_baseline";
const schema = process.env.PRISMA_SCHEMA_PATH || "prisma/schema.prisma";
const url = process.env.DATABASE_URL ?? "";

const prisma = (args: string[]) => spawnSync("npx", ["prisma", ...args, ...(args[0] === "migrate" && args[1] !== "diff" ? ["--schema", schema] : [])], { encoding: "utf-8", env: process.env });
const show = (r: ReturnType<typeof prisma>) => { if (r.stdout) process.stdout.write(r.stdout); if (r.stderr) process.stderr.write(r.stderr); };

async function main() {
  if (!/^postgres(ql)?:\/\//.test(url)) { console.error("db-migrate: DATABASE_URL must be a PostgreSQL URL."); process.exit(1); }
  const db = new PrismaClient({ datasources: { db: { url } } });
  let hasUsers = false, hasHistory = false;
  try {
    const rows = await db.$queryRawUnsafe<Array<{ t: string }>>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = current_schema() AND table_name IN ('User', '_prisma_migrations')`);
    hasUsers = rows.some((r) => r.t === "User");
    hasHistory = rows.some((r) => r.t === "_prisma_migrations");
  } finally { await db.$disconnect(); }

  if (hasUsers && !hasHistory) {
    console.log("db-migrate: this database was created by `prisma db push` (no migration history). Checking it against the baseline schema...");
    const diff = prisma(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", schema, "--exit-code"]);
    if (diff.status === 2) {
      console.error("db-migrate: STOPPED. The existing database differs from the schema the baseline describes, so it cannot be adopted automatically.");
      console.error("The differences are:\n" + diff.stdout);
      console.error("Nothing was changed. Back the database up, bring it up to date once with `npx prisma db push` (additive changes only), then run this again.");
      process.exit(3);
    }
    if (diff.status !== 0) { show(diff); console.error("db-migrate: could not compare the database with the schema."); process.exit(1); }
    const resolve = prisma(["migrate", "resolve", "--applied", BASELINE]);
    show(resolve);
    if (resolve.status !== 0) process.exit(1);
    console.log("db-migrate: existing database adopted (baseline recorded, no data touched).");
  }

  const deploy = prisma(["migrate", "deploy"]);
  show(deploy);
  if (deploy.status !== 0) { console.error("db-migrate: migrate deploy failed. The database was left as it was before the failing step; see the output above."); process.exit(1); }
  console.log("db-migrate: database is up to date.");
}
main().catch((e) => { console.error("db-migrate crashed:", e); process.exit(1); });

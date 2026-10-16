/**
 * One command to prepare a database for a host that has no start-up script (Vercel) — Phase 48. Works on Windows, macOS and Linux:
 *   1. applies the schema migrations (scripts/db-migrate.ts: never destructive on its own)
 *   2. loads the course (curriculum only, no accounts)
 *   3. creates the first administrator when ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD are set (never overwrites an account)
 *
 * Run it from your own computer against the DIRECT Neon address (the one without "-pooler"):
 *   PowerShell:  $env:DATABASE_URL="postgresql://...?sslmode=require"; npm run setup:db
 *   bash:        DATABASE_URL="postgresql://...?sslmode=require" npm run setup:db
 * Safe to run again: each step skips what already exists.
 */
import { spawnSync } from "child_process";

const url = process.env.DATABASE_URL ?? "";
if (!/^postgres(ql)?:\/\//.test(url)) {
  console.error("setup:db needs DATABASE_URL set to your PostgreSQL address (it must start with postgresql://).");
  process.exit(1);
}
try {
  if (/-pooler\./.test(new URL(url).hostname)) {
    console.error("setup:db: this is Neon's POOLED address (it contains \"-pooler\"). Migrations need the DIRECT address: in Neon, turn connection pooling off and copy the string again.");
    process.exit(1);
  }
} catch { /* the checks below report an unreadable address */ }

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
function step(label: string, args: string[], extra: Record<string, string> = {}, mayFail = false) {
  console.log(`\n== ${label} ==`);
  const r = spawnSync(npx, args, { stdio: "inherit", env: { ...process.env, ...extra }, shell: process.platform === "win32" });
  if (r.status !== 0 && !mayFail) { console.error(`setup:db stopped: "${label}" failed.`); process.exit(r.status ?? 1); }
  return r.status === 0;
}

step("1/3 Apply migrations", ["tsx", "scripts/db-migrate.ts"]);
step("2/3 Load the course", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" });
if (process.env.ADMIN_EMAIL && process.env.ADMIN_NAME && process.env.ADMIN_PASSWORD) {
  step("3/3 Create the first administrator", ["tsx", "scripts/create-admin.ts"], {}, true);
} else {
  console.log("\n== 3/3 First administrator ==\nSkipped: set ADMIN_EMAIL, ADMIN_NAME and ADMIN_PASSWORD to create it.");
}
console.log("\nsetup:db finished. Next: deploy, then open https://YOUR-ADDRESS/api/ready");

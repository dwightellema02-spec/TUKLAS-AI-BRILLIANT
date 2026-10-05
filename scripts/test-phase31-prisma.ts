/**
 * Tuklas AI - Phase 31 on PostgreSQL. Creates a brand-new empty database, applies the schema, seeds ONLY the
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
  const dbName = `tuklas_p31_${run}`;
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
  const adminEmail = `p31.admin.${run}@example.edu`;
  const adminPassword = `Boot-strap-${run}9`;
  const admin = sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P26 Admin", ADMIN_PASSWORD: adminPassword });
  assert(admin.status === 0, "Admin bootstrapped");

  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  assert((await db.user.count()) === 1, "The seeded database contains exactly one account (the admin): no demo users");
  assert((await db.lesson.count({ where: { status: "PUBLISHED" } })) >= 1 && (await db.skill.count()) >= 3, "...and the curriculum (published lesson + skills)");

  console.log("\n--- B. The surface suite against PostgreSQL (with a server restart) ---");
  const suite = sh("npx", ["tsx", "scripts/test-phase31-surface.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, RESTART_CHECK: "1", NODE_ENV: "development" });
  process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|RESULTS|Server up|crashed/.test(l)).join("\n") + "\n");
  if (suite.status !== 0) console.error(suite.stderr.slice(-500));
  assert(suite.status === 0, "Surface suite passes on PostgreSQL");

  console.log("\n--- C. What is actually in the database ---");
  assert((await db.question.count({ where: { prompt: { startsWith: "P31 " } } })) === 4, "The four authored questions (with their answer-bearing fields) are stored");
  const stored = await db.question.findFirst({ where: { prompt: "P31 mc" } });
  assert(!!stored && JSON.parse(stored.questionData).correctAnswer === "a", "...with their answer keys intact in PostgreSQL (the redaction is applied on the way out, not in storage)");
  assert((await db.questionAttempt.count({ where: { question: { prompt: { startsWith: "P31 " } } } })) === 3, "Student 1's 3 graded attempts are rows; Student 2 wrote none");

  console.log("\n--- D. Production: CSP, rate limit, error details ---");
  const startProd = async (port: number, extraEnv: Record<string, string>) => {
    const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, DATABASE_URL: freshUrl, PORT: String(port), NODE_ENV: "production", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), ...extraEnv }, stdio: "ignore", detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return srv; } catch { /* waiting */ } }
    throw new Error("prod server did not start");
  };
  const kill = async (srv: any) => { try { process.kill(-srv.pid, "SIGTERM"); } catch { /* gone */ } await new Promise((r) => setTimeout(r, 1200)); };
  const p1 = 4300 + Math.floor(Math.random() * 40);
  const prod = await startProd(p1, { API_RATE_LIMIT_PER_MINUTE: "40" });
  try {
    const page = await fetch(`http://127.0.0.1:${p1}/`);
    const csp = page.headers.get("content-security-policy") ?? "";
    assert(/script-src 'self'(;|$)/.test(csp) && !/script-src[^;]*unsafe/.test(csp), "Production CSP: scripts only from this site, no 'unsafe-inline' or 'unsafe-eval'");
    assert(/object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp) && /form-action 'self'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /frame-src https:\/\/www\.youtube-nocookie\.com/.test(csp), "...plus object-src none, base-uri / form-action self, no framing, and YouTube-only frames");
    assert(/connect-src 'self'(;|$)/.test(csp), "...and the page can only call its own API (connect-src 'self')");
    const apiRes = await fetch(`http://127.0.0.1:${p1}/api/health`);
    assert(!!apiRes.headers.get("content-security-policy"), "The CSP is sent on API responses too");
    let limited = 0, firstLimited = -1;
    for (let i = 0; i < 60; i++) {
      const r = await fetch(`http://127.0.0.1:${p1}/api/curriculum`);
      if (r.status === 429) { limited++; if (firstLimited < 0) firstLimited = i; }
    }
    assert(limited > 0 && firstLimited >= 30 && firstLimited <= 45, `The per-address API limit (40/min here) starts refusing at request ${firstLimited + 1} (429)`);
    assert((await fetch(`http://127.0.0.1:${p1}/api/health`)).status === 200, "...while /api/health stays available for monitoring");
  } finally { await kill(prod); }
  const p2 = 4350 + Math.floor(Math.random() * 40);
  const prod2 = await startProd(p2, { CSP_REPORT_ONLY: "true" });
  try {
    const page = await fetch(`http://127.0.0.1:${p2}/`);
    assert(page.headers.get("content-security-policy") === null && /script-src 'self'/.test(page.headers.get("content-security-policy-report-only") ?? ""), "CSP_REPORT_ONLY=true sends the policy as report-only (not enforced)");
  } finally { await kill(prod2); }

  await db.$disconnect();
  const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await drop.$disconnect();

  console.log(`\nPOSTGRES PHASE 31 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

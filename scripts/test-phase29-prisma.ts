/**
 * Tuklas AI - Phase 29 on PostgreSQL. Creates a brand-new empty database, applies the schema, seeds ONLY the
 * curriculum (the production-safe path), bootstraps an admin, then runs the research suite against it and
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
  const dbName = `tuklas_p29_${run}`;
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
  const adminEmail = `p29.admin.${run}@example.edu`;
  const adminPassword = `Boot-strap-${run}9`;
  const admin = sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P26 Admin", ADMIN_PASSWORD: adminPassword });
  assert(admin.status === 0, "Admin bootstrapped");

  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  assert((await db.user.count()) === 1, "The seeded database contains exactly one account (the admin): no demo users");
  assert((await db.lesson.count({ where: { status: "PUBLISHED" } })) >= 1 && (await db.skill.count()) >= 3, "...and the curriculum (published lesson + skills)");

  console.log("\n--- B. The research suite against PostgreSQL (with a server restart) ---");
  const suite = sh("npx", ["tsx", "scripts/test-phase29-research.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, RESTART_CHECK: "1", NODE_ENV: "development" });
  process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|RESULTS|Server up|crashed/.test(l)).join("\n") + "\n");
  if (suite.status !== 0) console.error(suite.stderr.slice(-500));
  assert(suite.status === 0, "Research suite passes on PostgreSQL");

  console.log("\n--- C. What is actually in the database ---");
  const rows = await db.questionAttempt.findMany();
  assert(rows.length === 18, `Practice attempts are rows in PostgreSQL (${rows.length} = 3 students x 6 questions)`);
  assert((await db.user.count({ where: { email: { endsWith: "@tuklas.ai" } } })) === 0, "No demo account exists");

  console.log("\n--- D. An EMPTY database stays empty (no demo fallback) ---");
  const emptyName = `${dbName}_empty`;
  const root2 = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root2.$executeRawUnsafe(`CREATE DATABASE "${emptyName}"`);
  await root2.$disconnect();
  const eu = new URL(url); eu.pathname = `/${emptyName}`;
  const emptyUrl = eu.toString();
  const pushEmpty = spawnSync("npx", ["prisma", "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: emptyUrl }, encoding: "utf-8" });
  assert(pushEmpty.status === 0, "Schema applied to a second, completely empty database (no curriculum seed)");
  const eAdminEmail = `e.${adminEmail}`;
  const eAdminPw = adminPassword;
  const mk = spawnSync("npx", ["tsx", "scripts/create-admin.ts"], { env: { ...process.env, DATABASE_URL: emptyUrl, ADMIN_EMAIL: eAdminEmail, ADMIN_NAME: "Empty Admin", ADMIN_PASSWORD: eAdminPw }, encoding: "utf-8" });
  assert(mk.status === 0, "Admin created in the empty database");
  const port = 3900 + Math.floor(Math.random() * 90);
  const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, DATABASE_URL: emptyUrl, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex") }, stdio: "ignore", detached: true });
  try {
    let up = false;
    for (let i = 0; i < 90 && !up; i++) { await new Promise((r) => setTimeout(r, 500)); try { up = (await fetch(`http://127.0.0.1:${port}/api/health`)).ok; } catch { /* waiting */ } }
    assert(up, "Server boots against the empty database");
    const base = `http://127.0.0.1:${port}`;
    const tok = (await (await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: eAdminEmail, password: eAdminPw }) })).json()).token as string;
    const get = async (path: string) => { const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${tok}` } }); return { status: r.status, json: (await r.json().catch(() => ({}))) as any }; };
    const lessons = await get("/api/lessons");
    assert(lessons.status === 200 && lessons.json.data.length === 0, "GET /api/lessons: empty (was the three demo lessons)");
    const cur = await get("/api/curriculum");
    assert(cur.status === 200 && !JSON.stringify(cur.json).includes("Understanding Integers"), "GET /api/curriculum: no demo curriculum");
    const sk = await get("/api/skills");
    assert(sk.status === 200 && sk.json.data.length === 0, "GET /api/skills: empty (was the demo skills)");
    const qs = await get("/api/questions");
    assert(qs.status === 200 && (qs.json.data?.questions ?? qs.json.data ?? []).length === 0, "GET /api/questions: empty");
    const ds = await get("/api/teacher/research/difficult-skills");
    const cmp = await get("/api/teacher/research/comparison");
    assert(ds.status === 200 && ds.json.data.length === 0 && cmp.json.data.comparison.observedTrend === "INSUFFICIENT_DATA", "Research on an empty database: nothing, and no invented comparison");
    const prof = await get("/api/teacher/research/profile/usr_student_01");
    assert([403, 404].includes(prof.status), "The demo student id is not a real student here (no 'Juan de la Cruz')");
  } finally {
    try { if (srv.pid) process.kill(-srv.pid, "SIGTERM"); } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 1500));
    const r3 = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
    await r3.$executeRawUnsafe(`DROP DATABASE "${emptyName}" WITH (FORCE)`);
    await r3.$disconnect();
  }

  await db.$disconnect();
  const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await drop.$disconnect();

  console.log(`\nPOSTGRES PHASE 29 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

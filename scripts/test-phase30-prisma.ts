/**
 * Tuklas AI - Phase 30 on PostgreSQL. Creates a brand-new empty database, applies the schema, seeds ONLY the
 * curriculum (the production-safe path), bootstraps an admin, then runs the sessions suite against it and
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
  const dbName = `tuklas_p30_${run}`;
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
  const adminEmail = `p30.admin.${run}@example.edu`;
  const adminPassword = `Boot-strap-${run}9`;
  const admin = sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P26 Admin", ADMIN_PASSWORD: adminPassword });
  assert(admin.status === 0, "Admin bootstrapped");

  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  assert((await db.user.count()) === 1, "The seeded database contains exactly one account (the admin): no demo users");
  assert((await db.lesson.count({ where: { status: "PUBLISHED" } })) >= 1 && (await db.skill.count()) >= 3, "...and the curriculum (published lesson + skills)");

  console.log("\n--- B. The sessions suite against PostgreSQL (with a server restart) ---");
  const suite = sh("npx", ["tsx", "scripts/test-phase30-sessions.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_PASSWORD: adminPassword, RESTART_CHECK: "1", NODE_ENV: "development" });
  process.stdout.write(suite.stdout.split("\n").filter((l) => /❌|RESULTS|Server up|crashed/.test(l)).join("\n") + "\n");
  if (suite.status !== 0) console.error(suite.stderr.slice(-500));
  assert(suite.status === 0, "Sessions suite passes on PostgreSQL");

  console.log("\n--- C. What is actually in the database ---");
  const users = await db.user.findMany({ where: { email: { contains: "p30." } }, orderBy: { email: "asc" } });
  const byTag = (t: string) => users.find((u) => u.email.includes(`p30.${t}.`))!;
  assert(byTag("u1").sessionVersion >= 2 && byTag("u1").role === "STUDENT", "u1: password change and role change each bumped the stored session version, and the role is STUDENT");
  assert(byTag("u3").disabledAt === null && byTag("u3").sessionVersion >= 2, "u3: disabled then enabled: disabledAt cleared, version bumped twice");
  assert(byTag("u2").sessionVersion >= 1 && byTag("u4").sessionVersion >= 1 && byTag("u5").sessionVersion >= 1, "u2 / u4 / u5: sign-out, admin revoke and password reset each bumped the version");
  const audit = await db.auditLog.findMany();
  assert(audit.length >= 15, `The audit log is a table in PostgreSQL (${audit.length} rows)`);
  assert(audit.every((r) => !/passwordHash|\$2[aby]\$|Fresh-Pass|Temp-Pass|Sturdy-Pass/.test(`${r.detail ?? ""}${r.action}`)), "No secret appears in any audit row");
  assert(audit.some((r) => r.action === "block.update" && r.detail !== null && !r.detail.includes("correctAnswer")), "An answer-key edit is recorded without the key");

  console.log("\n--- D. Production-mode cookie, header and origin policy ---");
  const startProd = async (port: number, extraEnv: Record<string, string>) => {
    const srv = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, DATABASE_URL: freshUrl, PORT: String(port), NODE_ENV: "production", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex"), ...extraEnv }, stdio: "ignore", detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return srv; } catch { /* waiting */ } }
    throw new Error("prod server did not start");
  };
  const kill = async (srv: any) => { try { process.kill(-srv.pid, "SIGTERM"); } catch { /* gone */ } await new Promise((r) => setTimeout(r, 1200)); };
  const loginRaw = (port: number, headers: Record<string, string> = {}) => fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
  const p1 = 4100 + Math.floor(Math.random() * 40);
  const prod = await startProd(p1, {});
  try {
    const r = await loginRaw(p1, { "X-Forwarded-Proto": "https" });
    const cookie = ((r.headers as any).getSetCookie() as string[]).find((c) => c.startsWith("tuklas_session="))!;
    assert(/HttpOnly/i.test(cookie) && /;\s*Secure/i.test(cookie) && /SameSite=Lax/i.test(cookie), "Production cookie: HttpOnly; Secure; SameSite=Lax (it used to be SameSite=None)");
    assert(r.headers.get("x-frame-options") === "DENY" && /frame-ancestors 'none'/.test(r.headers.get("content-security-policy") ?? ""), "Production: the app cannot be framed by other sites (X-Frame-Options + frame-ancestors)");
    assert(/max-age=/.test(r.headers.get("strict-transport-security") ?? ""), "Production over https: Strict-Transport-Security is sent");
    assert((await loginRaw(p1, { Origin: "https://evil.example" })).status === 403, "Production: a cross-origin login POST is refused");
    // Defence in depth: the account's CURRENT state is checked on every request, not only the session version.
    const tok = ((await (await loginRaw(p1)).json()) as any).token as string;
    const call = async (path: string) => (await fetch(`http://127.0.0.1:${p1}${path}`, { headers: { Authorization: `Bearer ${tok}` } })).status;
    assert((await call("/api/admin/users")) === 403, "(Phase 43) production asks the new administrator to accept the privacy notice first");
    await fetch(`http://127.0.0.1:${p1}/api/auth/accept-privacy`, { method: "POST", headers: { Authorization: `Bearer ${tok}` } });
    assert((await call("/api/admin/users")) === 200, "The bootstrapped administrator's token works");
    await db.user.update({ where: { email: adminEmail }, data: { role: "TEACHER" } }); // changed behind the app's back: no version bump
    assert((await call("/api/admin/users")) === 403, "A role changed directly in the database applies on the very next request (the token still says ADMIN)");
    await db.user.update({ where: { email: adminEmail }, data: { role: "ADMIN", disabledAt: new Date() } }); // disabled behind the app's back
    assert((await call("/api/auth/me")) === 401, "An account disabled directly in the database is refused on the very next request");
    await db.user.update({ where: { email: adminEmail }, data: { disabledAt: null } });
    assert((await call("/api/auth/me")) === 200, "...and works again once re-enabled (no version was bumped)");
    assert((await loginRaw(p1, { Origin: "https://partner.example" })).status === 403, "...an origin that was not listed is refused too");
    const page = await fetch(`http://127.0.0.1:${p1}/`);
    assert(page.status === 200 && page.headers.get("x-content-type-options") === "nosniff", "The web app itself is served with the security headers");
  } finally { await kill(prod); }
  const p2 = 4150 + Math.floor(Math.random() * 40);
  const prod2 = await startProd(p2, { COOKIE_SAMESITE: "none", ALLOWED_ORIGINS: "https://partner.example", ALLOW_EMBEDDING: "true" });
  try {
    const r = await loginRaw(p2, { Origin: "https://partner.example" });
    const cookie = ((r.headers as any).getSetCookie() as string[]).find((c) => c.startsWith("tuklas_session="))!;
    assert(r.status === 200 && /SameSite=None/i.test(cookie) && /;\s*Secure/i.test(cookie), "COOKIE_SAMESITE=none gives SameSite=None; Secure, and a listed ALLOWED_ORIGINS origin may post");
    assert(r.headers.get("x-frame-options") === null, "ALLOW_EMBEDDING=true drops the anti-framing headers");
    assert((await loginRaw(p2, { Origin: "https://evil.example" })).status === 403, "...while an unlisted origin is still refused");
  } finally { await kill(prod2); }

  await db.$disconnect();
  const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  await drop.$disconnect();

  console.log(`\nPOSTGRES PHASE 30 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

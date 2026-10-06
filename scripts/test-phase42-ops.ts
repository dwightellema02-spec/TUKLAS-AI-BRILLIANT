/**
 * Tuklas AI - Phase 42: running it for real. Needs DATABASE_URL (PostgreSQL, CREATE DATABASE allowed) and a built app (`npm run build`).
 *   - check-env: the settings report
 *   - start-production.sh on an EMPTY database: migrates, loads the curriculum, creates the first admin, serves; a second start is harmless;
 *     bad settings stop it before anything is touched
 *   - /api/health (alive) and /api/ready (can do its job), including a half-applied migration and a database that goes away
 *   - SIGTERM: requests in flight finish, the process exits 0
 */
import crypto from "crypto";
import http from "http";
import { spawn, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";
import { checkEnv } from "./check-env";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };

  console.log("--- A. check-env ---");
  const good = { NODE_ENV: "production", DATABASE_URL: "postgresql://u:p@db.example.com/x?sslmode=require", AUTH_SECRET: "a".repeat(40), APP_URL: "https://tuklas.example.edu", TRUST_PROXY: "true", AI_PROVIDER: "local", DOCUMENT_STORAGE_DIR: "/tmp/p42-docs" } as NodeJS.ProcessEnv;
  const rGood = checkEnv(good);
  assert(rGood.fatal.length === 0 && rGood.warnings.length === 0, `A complete production setup has no problems (${[...rGood.fatal, ...rGood.warnings].join("; ")})`);
  assert(checkEnv({ ...good, AUTH_SECRET: "short" }).fatal.some((f) => /AUTH_SECRET/.test(f)) && checkEnv({ ...good, AUTH_SECRET: "placeholder_secret_min_32_characters_long" }).fatal.length > 0, "A short or placeholder AUTH_SECRET is fatal in production");
  assert(checkEnv({ ...good, DATABASE_URL: undefined }).fatal.some((f) => /DATABASE_URL/.test(f)) && checkEnv({ ...good, DATABASE_URL: "mysql://x" }).fatal.length > 0, "No database, or not PostgreSQL, is fatal");
  assert(checkEnv({ ...good, DATABASE_URL: undefined, ALLOW_DEMO_MODE: "I_UNDERSTAND_DEMO_ACCOUNTS_ARE_PUBLIC" }).fatal.length === 0, "...unless the public-demo switch is on, which is a loud warning");
  const w = checkEnv({ ...good, APP_URL: "http://x", TRUST_PROXY: undefined, AI_PROVIDER: "gemini", ADMIN_PASSWORD: "x", API_RATE_LIMIT_PER_MINUTE: "0" }).warnings.join(" ");
  assert(/https/.test(w) && /TRUST_PROXY/.test(w) && /GEMINI_API_KEY/.test(w) && /ADMIN_PASSWORD/.test(w) && /turns the request ceiling off/.test(w), "Warnings for http, no proxy setting, gemini without a key, a leftover admin password, rate limit off");
  assert(checkEnv({ ...good, DATABASE_URL: "postgresql://u:p@db.example.com/x" }).warnings.some((x) => /sslmode/.test(x)), "A hosted database without sslmode is flagged");
  assert(checkEnv({ ...good, DOCUMENT_STORAGE_DIR: "/dev/null/docs" }).warnings.some((x) => /not writable/.test(x)), "An unwritable document folder is flagged");
  assert(checkEnv({ NODE_ENV: "development" }).fatal.length === 0, "A plain development run is fine");

  const run = crypto.randomBytes(3).toString("hex");
  const adminUrl = new URL(url); adminUrl.pathname = "/postgres";
  const dbName = `tuklas_p42o_${run}`;
  const u = new URL(url); u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  const port = 6800 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
  const adminEmail = `p42.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
  const env = { ...process.env, NODE_ENV: "production", DATABASE_URL: freshUrl, AUTH_SECRET: crypto.randomBytes(24).toString("hex"), PORT: String(port), AI_PROVIDER: "local", TRUST_PROXY: "true", APP_URL: "https://tuklas.example.edu", ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P42 Admin", ADMIN_PASSWORD: adminPassword, DOCUMENT_STORAGE_DIR: `/tmp/p42-docs-${run}` } as NodeJS.ProcessEnv;
  let server: ChildProcess | undefined;
  let output = "";
  const t0 = Date.now(); const mark = (m: string) => console.log(`    [${Math.round((Date.now() - t0) / 1000)}s] ${m}`);
  const start = (e: NodeJS.ProcessEnv) => { mark("starting start-production.sh"); output = ""; const p = spawn("sh", ["scripts/start-production.sh"], { env: e, detached: true }); p.stdout?.on("data", (d) => (output += d)); p.stderr?.on("data", (d) => (output += d)); return p; };
  const up = async (ms = 90000) => { for (let i = 0; i < ms / 500; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) return true; } catch { /* */ } } return false; };
  const stop = async (p?: ChildProcess) => { if (!p?.pid) return; try { process.kill(-p.pid, "SIGTERM"); } catch { /* */ } await new Promise((r) => setTimeout(r, 2000)); try { process.kill(-p.pid, "SIGKILL"); } catch { /* */ } };
  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  try {
    console.log("\n--- B. First start on an empty database (start-production.sh) ---");
    const bad = start({ ...env, AUTH_SECRET: "short" });
    const badCode = await new Promise<number | null>((res) => bad.on("exit", (c) => res(c)));
    assert(badCode !== 0 && /AUTH_SECRET/.test(output), "Bad settings stop the start with a clear message");
    assert((await db.$queryRawUnsafe<any[]>(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`))[0].n === 0, "...before the database was touched");
    server = start(env);
    const cameUp = await up(); mark("up() returned " + cameUp);
    assert(cameUp, "The server comes up");
    assert(/up to date/.test(output) && /Curriculum hierarchy/.test(output) && /Administrator created/.test(output), "It migrated, loaded the curriculum and created the first administrator");
    assert((await db.user.count()) === 1 && (await db.lesson.count()) === 7, "The database has one account (the admin) and the 7-lesson course");
    const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-Proto": "https" }, body: JSON.stringify({ email: adminEmail, password: adminPassword }) });
    assert(login.status === 200, "The first administrator can sign in");
    assert((await fetch(`${base}/`)).headers.get("content-type")?.includes("text/html") === true, "The built web app is served");
    // essential API routes must answer JSON in production (a route that went missing used to fall through to the web page with a 200)
    const tok = (await login.clone().json()).token as string;
    const essentials = ["/api/curriculum", "/api/lessons", "/api/skills", "/api/questions", "/api/practice-sets", "/api/auth/me", "/api/student/learning-path", "/api/teacher/dashboard", "/api/admin/users"];
    const wrong: string[] = [];
    for (const p of essentials) { const r = await fetch(base + p, { headers: { Authorization: `Bearer ${tok}`, "X-Forwarded-Proto": "https" } }); if (!(r.headers.get("content-type") ?? "").includes("application/json")) wrong.push(`${p} -> ${r.status} ${r.headers.get("content-type")}`); }
    assert(wrong.length === 0, `Essential API routes answer JSON in production (${wrong.join("; ") || essentials.length + " checked"})`);
    const typo = await fetch(`${base}/api/no-such-route`);
    assert(typo.status === 404 && (typo.headers.get("content-type") ?? "").includes("json"), "An address under /api that does not exist is a JSON 404, not the web page");

    console.log("\n--- C. Health and readiness ---");
    const h = await (await fetch(`${base}/api/health`)).json();
    assert(h.status === "ok" && h.database.connected === true && /^\d+\.\d+\.\d+/.test(h.version) && h.database.details === undefined, `/api/health is alive and tells nothing internal (${JSON.stringify(h.database)}, v${h.version})`);
    const rd = await fetch(`${base}/api/ready`);
    assert(rd.status === 200 && (await rd.json()).ready === true, "/api/ready is ready");
    await db.$executeRawUnsafe(`UPDATE _prisma_migrations SET finished_at = NULL`);
    const half = await fetch(`${base}/api/ready`);
    const halfBody = await half.json();
    assert(half.status === 503 && halfBody.ready === false && Object.keys(halfBody).length === 1, "A half-applied migration makes it NOT ready (503) and the answer says nothing more");
    assert((await fetch(`${base}/api/health`)).status === 200, "...but it is still alive (a restart would not help)");
    await db.$executeRawUnsafe(`UPDATE _prisma_migrations SET finished_at = now()`);
    assert((await fetch(`${base}/api/ready`)).status === 200, "Ready again once the migration is finished");

    console.log("\n--- D. Second start (a redeploy) ---");
    // Three requests that are certainly in flight: connected, headers and half the body sent, the rest held back until after SIGTERM.
    const body = JSON.stringify({ email: adminEmail, password: "wrong-password-1" });
    const mid = Math.floor(body.length / 2);
    const slowReq = () => new Promise<{ status: number | string; connection?: string }>((resolve) => {
      const req = http.request({ host: "127.0.0.1", port, method: "POST", path: "/api/auth/login", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } }, (res) => { res.resume(); res.on("end", () => resolve({ status: res.statusCode ?? 0, connection: String(res.headers.connection) })); });
      req.on("error", (e: any) => resolve({ status: `broken:${e.code}` }));
      req.write(body.slice(0, mid));
      setTimeout(() => req.end(body.slice(mid)), 1500);
    });
    const inflight = [slowReq(), slowReq(), slowReq()];
    await new Promise((r) => setTimeout(r, 400));
    const exited = new Promise<number | null>((res) => server!.on("exit", (c) => res(c)));
    process.kill(server.pid!, "SIGTERM"); // what Docker / Render send: the main process only
    await new Promise((r) => setTimeout(r, 300));
    const refused = await fetch(`${base}/api/health`).then(() => "answered").catch((e) => e?.cause?.code ?? "error");
    const results = await Promise.all(inflight);
    const code = await Promise.race([exited, new Promise<null>((r) => setTimeout(() => r(null), 15000))]);
    assert(results.every((r) => r.status === 401), `Requests being handled when SIGTERM arrives are finished and answered (${results.map((r) => r.status).join(",")})`);
    assert(results.every((r) => r.connection === "close"), "...and told to close the connection, so clients do not reuse it");
    assert(refused === "ECONNREFUSED", `New connections are refused while it shuts down (${refused})`);
    assert(code === 0 && /Shut down cleanly/.test(output), `The process then exits 0 after closing the database (exit ${code})`);
    server = start(env);
    assert(await up(), "Starting again against the same database works");
    assert((await db.user.count()) === 1 && /up to date/.test(output), "...no second admin, nothing duplicated (migration and seed are repeatable)");

    console.log("\n--- E. The database goes away ---");
    await root.$executeRawUnsafe(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid()`);
    await db.$disconnect();
    await root.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`);
    const gone = await fetch(`${base}/api/ready`);
    const goneBody = JSON.stringify(await gone.json());
    assert(gone.status === 503 && !/prisma|127\.0\.0\.1|refused|error/i.test(goneBody), "Not ready (503), and the answer does not leak connection details");
    const alive = await (await fetch(`${base}/api/health`)).json();
    assert(alive.status === "ok" && alive.database.connected === false && !/127\.0\.0\.1|refused|prisma|error|@/i.test(JSON.stringify(alive)), "Still alive; reports 'not connected' without the error text");
  } finally {
    await stop(server);
    await root.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
    await root.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 42 OPS RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

/**
 * Tuklas AI - Phase 47: a database that is asleep or restarting. Needs DATABASE_URL (a PostgreSQL the test can reach).
 *   A. the retry rules, with a fake clock (what is retried, what never is, and for how long)
 *   B. the real server through a proxy that is switched off and on like a sleeping hosted database
 */
import crypto from "crypto";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";
import { classifyDbError, isRetryable, withDbRetry, withConnectionSettings } from "../src/lib/db-resilience";
import { createFlakyProxy } from "./lib/flaky-proxy";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);
const err = (code: string | undefined, message: string, name = "PrismaClientKnownRequestError") => Object.assign(new Error(message), { code, name });

async function main() {
  section("A. The retry rules");
  assert(classifyDbError(err("P1001", "Can't reach database server at `x`:5432")) === "not-reached", "P1001 (cannot reach) = never reached");
  assert(classifyDbError(err(undefined, "Can't reach database server at `ep-x.neon.tech`", "PrismaClientInitializationError")) === "not-reached", "A start-up 'cannot reach' = never reached");
  assert(classifyDbError(err("P2024", "Timed out fetching a new connection from the connection pool")) === "not-reached", "A pool timeout = never reached");
  assert(classifyDbError(err("P1017", "Server has closed the connection.")) === "closed", "P1017 = a connection that was closed");
  assert(classifyDbError(err("P2002", "Unique constraint failed on the fields: (`email`)")) === "other", "A duplicate key is a real answer, not an outage");
  assert(classifyDbError(err("P2025", "Record to update not found.")) === "other" && classifyDbError(new Error("boom")) === "other", "A missing row and an ordinary error are real answers too");
  assert(isRetryable("not-reached", "create") && isRetryable("not-reached", "findMany"), "Never-reached: any operation, a write too, may be tried again (nothing was sent)");
  assert(isRetryable("closed", "findMany") && isRetryable("closed", "$queryRaw") && !isRetryable("closed", "create") && !isRetryable("closed", "update") && !isRetryable("closed", "delete") && !isRetryable("closed", "$executeRaw"), "A closed connection: reads are tried again, writes NEVER (the write may have happened)");
  assert(!isRetryable("other", "findMany"), "Real answers are never retried");

  let t = 0; const sleeps: number[] = [];
  const clock = { now: () => t, sleep: async (ms: number) => { sleeps.push(ms); t += ms; } };
  let calls = 0;
  const flaky = async () => { calls++; if (calls < 4) throw err("P1001", "Can't reach database server"); return "ok"; };
  assert((await withDbRetry(flaky, "findMany", clock)) === "ok" && calls === 4 && sleeps.join() === "250,500,1000", `Wakes up on the 4th try after waiting ${sleeps.join(" + ")} ms (backing off)`);
  calls = 0; t = 0; sleeps.length = 0;
  const always = async () => { calls++; throw err("P1001", "Can't reach database server"); };
  let thrown: any; try { await withDbRetry(always, "findMany", { ...clock, budgetMs: 5000 }); } catch (e) { thrown = e; }
  assert(thrown?.code === "P1001" && t <= 5000 && calls >= 4, `A database that stays away: gives up inside the 5 s budget (${calls} tries, ${t} ms) and returns the ORIGINAL error`);
  calls = 0; t = 0; sleeps.length = 0;
  try { await withDbRetry(async () => { calls++; throw err("P2002", "Unique constraint failed"); }, "create", clock); } catch { /* expected */ }
  assert(calls === 1 && sleeps.length === 0, "A duplicate key is returned at once, with no waiting");
  calls = 0;
  try { await withDbRetry(async () => { calls++; throw err("P1017", "Server has closed the connection."); }, "update", clock); } catch { /* expected */ }
  assert(calls === 1, "A write on a closed connection is not repeated (it could be applied twice)");
  calls = 0;
  assert((await withDbRetry(async () => { calls++; if (calls === 1) throw err("P1017", "Server has closed the connection."); return 7; }, "findFirst", clock)) === 7 && calls === 2, "A read on a closed connection is repeated and succeeds");
  calls = 0;
  try { await withDbRetry(always, "findMany", { ...clock, budgetMs: 0 }); } catch { /* expected */ }
  assert(calls === 1, "A budget of 0 switches retrying off");
  const set1 = withConnectionSettings("postgresql://u:p@h/db?sslmode=require", {})!;
  assert(/connect_timeout=15/.test(set1) && /connection_limit=5/.test(set1) && /max_idle_connection_lifetime=120/.test(set1) && /sslmode=require/.test(set1), "A PostgreSQL address gets a 15 s connect timeout, a pool of 5 and a 120 s idle limit, keeping what it already had");
  const set2 = withConnectionSettings("postgresql://u:p@h/db?connect_timeout=3&connection_limit=9", {})!;
  assert(/connect_timeout=3(&|$)/.test(set2) && /connection_limit=9/.test(set2), "Settings already in the address are left alone");
  assert(/connection_limit=7/.test(withConnectionSettings("postgresql://u:p@h/db", { DB_CONNECTION_LIMIT: "7" })!) && withConnectionSettings(undefined) === undefined && withConnectionSettings("mysql://x") === "mysql://x", "The limits can be set by environment variables; non-PostgreSQL addresses are untouched");

  section("B. The real server behind a database that goes to sleep");
  const real = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(real)) { console.log("  SKIPPED part B: DATABASE_URL is not a PostgreSQL URL."); console.log(`\nPHASE 47 RESILIENCE RESULTS: ${passed} passed, ${failed} failed (part B skipped)`); process.exit(failed > 0 ? 1 : 0); }
  // a brand-new database built from the real migrations (so /api/ready can tell the migrations are finished)
  const dbName = `tuklas_p47_${crypto.randomBytes(3).toString("hex")}`;
  const adminU = new URL(real); adminU.pathname = "/postgres";
  const freshU = new URL(real); freshU.pathname = `/${dbName}`;
  const rootDb = new PrismaClient({ datasources: { db: { url: adminU.toString() } } });
  await rootDb.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  assert(spawnSync("npx", ["prisma", "migrate", "deploy"], { env: { ...process.env, DATABASE_URL: freshU.toString() }, encoding: "utf-8" }).status === 0, "(setup) a fresh database built from the real migrations");
  const ru = freshU;
  const proxyPort = 7400 + Math.floor(Math.random() * 90), port = proxyPort + 100;
  const proxy = createFlakyProxy(proxyPort, { host: ru.hostname, port: Number(ru.port || 5432) });
  await proxy.start();
  const viaProxy = new URL(freshU.toString()); viaProxy.hostname = "127.0.0.1"; viaProxy.port = String(proxyPort);
  const base = `http://127.0.0.1:${port}`;
  let logs = "";
  const server: ChildProcess = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, DATABASE_URL: viaProxy.toString(), PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex"), DB_RETRY_BUDGET_MS: "12000", DB_MAX_IDLE_CONNECTION_SECONDS: "2" }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  server.stdout?.on("data", (d) => (logs += d)); server.stderr?.on("data", (d) => (logs += d));
  try {
    for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/ready`)).ok) break; } catch { /* */ } }
    const run = crypto.randomBytes(3).toString("hex");
    const call = async (m: string, p: string, b?: unknown, tok?: string) => { const t0 = Date.now(); const r = await fetch(base + p, { method: m, headers: { ...(b ? { "Content-Type": "application/json" } : {}), ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, json: (await r.json().catch(() => ({}))) as any, ms: Date.now() - t0 }; };
    const email = `p47.${run}@example.edu`;
    const reg = await call("POST", "/api/auth/register", { name: "Pupil", email, password: "Sturdy-Pass1" });
    assert(reg.status === 200 || reg.status === 201, `(setup) registered through the proxy (${reg.status})`);
    const tok = reg.json.token as string;
    assert((await call("GET", "/api/skills", undefined, tok)).status === 200, "(setup) a read works while the database is reachable");

    const idle = () => new Promise((r) => setTimeout(r, 3500)); // longer than DB_MAX_IDLE_CONNECTION_SECONDS: the server has closed its idle connections, as before a host suspends the database

    // B1. the database is suspended for 4 seconds (no connection was open: it was idle)
    await idle();
    await proxy.down();
    setTimeout(() => { proxy.up().catch(() => undefined); }, 4000);
    const read = await call("GET", "/api/skills", undefined, tok);
    assert(read.status === 200 && read.ms >= 3500 && read.ms < 11000, `B1. A read that arrives while the database sleeps waits and then succeeds (${read.status} after ${read.ms} ms)`);
    assert(/not reachable/.test(logs), "...and the wait is logged");

    await idle();
    await proxy.down();
    setTimeout(() => { proxy.up().catch(() => undefined); }, 3000);
    const email2 = `p47b.${run}@example.edu`;
    const write = await call("POST", "/api/auth/register", { name: "Pupil Two", email: email2, password: "Sturdy-Pass1" });
    assert((write.status === 200 || write.status === 201) && write.ms >= 2500, `A sign-up that arrives while it sleeps also succeeds (${write.status} after ${write.ms} ms)`);
    assert((await call("POST", "/api/auth/login", { email: email2, password: "Sturdy-Pass1" })).status === 200, "...the account exists and can sign in");
    assert((await call("POST", "/api/auth/register", { name: "Pupil Two", email: email2, password: "Sturdy-Pass1" })).status === 409, "...exactly once: a second sign-up with the same email is refused (the retry did not create a duplicate)");

    // B2. a database that stays away longer than the budget
    await idle();
    await proxy.down();
    const t0 = Date.now();
    const gone = await call("GET", "/api/skills", undefined, tok);
    const waited = Date.now() - t0;
    assert(gone.status >= 500 && waited >= 9000 && waited < 20000, `B2. A database that stays away: the request fails after about the 12 s budget (${gone.status} after ${waited} ms), it does not hang`);
    assert((await fetch(`${base}/api/health`)).status === 200, "The server itself stays up and answers /api/health while the database is gone");
    await proxy.up();
    await new Promise((r) => setTimeout(r, 500));
    const back = await call("GET", "/api/skills", undefined, tok);
    assert(back.status === 200, `When the database comes back the next request works at once (${back.ms} ms): nothing is stuck`);
    const rd = await fetch(`${base}/api/ready`);
    assert(rd.status === 200, `/api/ready is ready again (${rd.status} ${await rd.text()})`);

    // B3. connections cut while they are in use (a restart), then the database is straight back
    for (let i = 0; i < 6; i++) await call("GET", "/api/skills", undefined, tok);
    await proxy.down(); await proxy.up();
    const cutRead = await call("GET", "/api/skills", undefined, tok);
    assert(cutRead.status === 200 && cutRead.ms < 4000, `B3. After a cut a read recovers by itself, discarding the dead connections (${cutRead.status} after ${cutRead.ms} ms)`);
    for (let i = 0; i < 6; i++) await call("GET", "/api/skills", undefined, tok);
    await proxy.down(); await proxy.up();
    const email3 = `p47c.${run}@example.edu`;
    const outcomes: number[] = [];
    for (let i = 0; i < 3; i++) { const r = await call("POST", "/api/auth/register", { name: "Pupil Three", email: email3, password: "Sturdy-Pass1" }); outcomes.push(r.status); if (r.status === 200 || r.status === 201) break; }
    assert(outcomes.some((x) => x === 200 || x === 201), `A write straight after a cut may fail once (it is never repeated automatically, because it might have been applied) but works on the next try (${outcomes.join(" then ")})`);
  } finally {
    try { process.kill(-server.pid!, "SIGKILL"); } catch { /* */ }
    await proxy.down().catch(() => undefined);
    await rootDb.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => undefined);
    await rootDb.$disconnect();
  }
  if (failed > 0 && process.env.SHOW_LOGS) console.log("\nserver log:\n" + logs.split("\n").filter((l) => /NOT READY|rror|reach|database|P1\d\d\d/i.test(l)).slice(-25).join("\n").slice(0, 3000));
  console.log(`\nPHASE 47 RESILIENCE RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

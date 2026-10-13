/**
 * Phase 48 - the request-limit store and the serverless-host settings.
 * Memory mode always. Shared (database) mode too when DATABASE_URL is a PostgreSQL address that has the RateEvent table
 * (npm run test:phase48:pg builds such a database). The same assertions run in both modes: only where the counts live differs.
 */
import { withConnectionSettings } from "../src/lib/db-resilience";
import { originalsAreKept, maxUploadBytes } from "../src/lib/documents/file-store";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };

async function main() {
  delete process.env.VERCEL; delete process.env.DURABLE_RATE_LIMITS;
  const store = await import("../src/lib/rate-store");
  const { prisma, hasValidDatabaseUrl } = await import("../src/lib/db");
  const throttle = await import("../src/lib/auth/login-throttle");
  const { AITutorService } = await import("../src/lib/ai/tutor");

  console.log("--- A. Settings for a serverless host ---");
  assert(originalsAreKept({} as any) && !originalsAreKept({ VERCEL: "1" } as any), "Originals are kept on a normal server and not on Vercel");
  assert(originalsAreKept({ VERCEL: "1", STORE_ORIGINALS: "true" } as any) && !originalsAreKept({ STORE_ORIGINALS: "false" } as any), "STORE_ORIGINALS overrides either way");
  assert(maxUploadBytes({} as any) === 25 * 1024 * 1024 && maxUploadBytes({ VERCEL: "1" } as any) === 4 * 1024 * 1024, "Upload limit is 25 MB normally and 4 MB on Vercel (its request ceiling is 4.5 MB)");
  assert(maxUploadBytes({ MAX_UPLOAD_BYTES: "1000000" } as any) === 1000000 && maxUploadBytes({ MAX_UPLOAD_BYTES: "999999999" } as any) === 25 * 1024 * 1024, "MAX_UPLOAD_BYTES can lower the limit but never raise it above 25 MB");
  const pooled = new URL(withConnectionSettings("postgresql://u:p@ep-x-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require", { VERCEL: "1" } as any)!);
  assert(pooled.searchParams.get("pgbouncer") === "true" && pooled.searchParams.get("connection_limit") === "3" && pooled.searchParams.get("sslmode") === "require", "Neon's pooled address on Vercel: pgbouncer=true, 3 connections, sslmode kept");
  const direct = new URL(withConnectionSettings("postgresql://u:p@ep-x.ap-southeast-1.aws.neon.tech/neondb?sslmode=require", {} as any)!);
  assert(!direct.searchParams.has("pgbouncer") && direct.searchParams.get("connection_limit") === "5", "A direct address on a normal server is unchanged: no pgbouncer, 5 connections");
  assert(new URL(withConnectionSettings("postgresql://u:p@ep-x-pooler.a.neon.tech/db?connection_limit=7&pgbouncer=false", { VERCEL: "1" } as any)!).searchParams.get("connection_limit") === "7", "Settings already in the address win");

  const suite = async (mode: string) => {
    console.log(`\n--- ${mode}: counting events ---`);
    const k = `t48:${mode}:${Math.random().toString(36).slice(2, 8)}`;
    const a = await store.rateHit(k, 3, 60_000), b = await store.rateHit(k, 3, 60_000), c = await store.rateHit(k, 3, 60_000), d = await store.rateHit(k, 3, 60_000);
    assert(a.ok && b.ok && c.ok && !d.ok && d.retryAfterSeconds >= 1 && d.retryAfterSeconds <= 60, `3 allowed, the 4th refused with a wait of ${d.retryAfterSeconds}s`);
    assert(!(await store.rateHit(k, 3, 60_000)).ok, "...and a refused event is not counted (still refused)");
    assert((await store.rateHit(`${k}:other`, 3, 60_000)).ok, "Another key is independent");
    const shortKey = `${k}:short`;
    await store.rateHit(shortKey, 1, 150);
    assert(!(await store.rateHit(shortKey, 1, 150)).ok, "Refused inside the window");
    await new Promise((r) => setTimeout(r, 200));
    assert((await store.rateHit(shortKey, 1, 150)).ok, "Allowed again after the window passes");

    console.log(`\n--- ${mode}: failures and blocks ---`);
    const fk = [`email:${k}@x.edu`, `ip:${k}`];
    const limit = (key: string) => (key.startsWith("email:") ? 3 : 100);
    assert((await store.blockedFor(fk)) === 0, "Nothing blocked at first");
    await store.recordFailures(fk, limit, 60_000, 60_000); await store.recordFailures(fk, limit, 60_000, 60_000);
    assert((await store.blockedFor(fk)) === 0, "Two failures: not blocked");
    await store.recordFailures(fk, limit, 60_000, 60_000);
    const wait = await store.blockedFor(fk);
    assert(wait > 55_000 && wait <= 60_000, `The third failure blocks the account for about a minute (${Math.round(wait / 1000)}s)`);
    assert((await store.blockedFor([fk[1]])) === 0, "...but not the other key (the address has its own, higher limit)");
    await store.clearFailures([fk[0]]);
    assert((await store.blockedFor(fk)) === 0, "A successful sign-in (clearFailures) lifts the block");

    console.log(`\n--- ${mode}: sign-in throttle and tutor limit through their real modules ---`);
    const email = `email:${k}@y.edu`;
    for (let i = 0; i < 7; i++) await throttle.recordLoginFailure([email]);
    assert((await throttle.checkLoginThrottle([email])).allowed, "7 wrong passwords: still allowed");
    await throttle.recordLoginFailure([email]);
    const gate = await throttle.checkLoginThrottle([email]);
    assert(!gate.allowed && gate.retryAfterSeconds > 800, `The 8th wrong password blocks for about 15 minutes (${gate.retryAfterSeconds}s)`);
    await throttle.clearLoginFailures([email]);
    assert((await throttle.checkLoginThrottle([email])).allowed, "Cleared");
    const sid = `stu-${k}`;
    let allowedCount = 0; for (let i = 0; i < 25; i++) if ((await AITutorService.checkRateLimit(sid)).allowed) allowedCount++;
    assert(allowedCount === 20, `The tutor allows 20 questions a minute per student (${allowedCount})`);
    const first = await AITutorService.checkRateLimit(`${sid}-b`);
    assert(first.allowed && first.remaining === 19, "A new student starts with 19 remaining after the first question");
  };

  console.log("=== Memory mode ===");
  assert(!store.isSharedMode(), "Memory mode is the default (no VERCEL, no DURABLE_RATE_LIMITS)");
  await suite("memory");

  if (hasValidDatabaseUrl) {
    const hasTable = await prisma.$queryRawUnsafe<any[]>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'RateEvent'`).then((r) => r.length === 1);
    if (hasTable) {
      console.log("\n=== Shared (database) mode ===");
      process.env.VERCEL = "1";
      assert(store.isSharedMode(), "VERCEL + PostgreSQL turns shared mode on");
      process.env.DURABLE_RATE_LIMITS = "false";
      assert(!store.isSharedMode(), "DURABLE_RATE_LIMITS=false turns it off");
      delete process.env.DURABLE_RATE_LIMITS;
      await suite("shared");
      const rows = await prisma.rateEvent.count({ where: { key: { startsWith: "tutor:stu-t48:shared", not: { endsWith: "-b" } } } });
      assert(rows === 20, `The counts are rows in the database (${rows} tutor rows for the 20 allowed questions)`);
      await prisma.rateEvent.deleteMany({});
    } else console.log("\n(Shared mode skipped: the database has no RateEvent table)");
  } else console.log("\n(Shared mode skipped: no PostgreSQL DATABASE_URL)");

  await prisma.$disconnect().catch(() => {});
  console.log(`\nPHASE 48 STORE RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

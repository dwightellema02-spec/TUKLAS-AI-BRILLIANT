/**
 * Phase 48: where request-limit counters live.
 *
 *  - memory (default): a Map in this process. Correct for ONE server process (Render, Docker, a laptop); every restart resets it.
 *  - shared (Vercel, or DURABLE_RATE_LIMITS=true, and only with a PostgreSQL database): rows in the `RateEvent` table. A serverless host
 *    runs many short-lived instances that share no memory, so a sign-in lockout kept in memory would not hold: the attacker would
 *    simply be sent to another instance. In the shared mode every instance sees the same counters.
 *
 * Both modes give the same answers; only where the counts are kept differs. The broad per-request ceilings in server.ts stay in memory in
 * both modes (a database write on every request would load the free database); only the limits that protect accounts, the AI model and
 * uploads use this store.
 */
import { hasValidDatabaseUrl, prisma } from "./db";

export function isSharedMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const asked = env.DURABLE_RATE_LIMITS === "true" || (!!env.VERCEL && env.DURABLE_RATE_LIMITS !== "false");
  return asked && hasValidDatabaseUrl;
}

export interface HitResult { ok: boolean; count: number; retryAfterSeconds: number }

// ---- memory mode ----
const hits = new Map<string, number[]>();
const blocks = new Map<string, number>(); // key -> blocked until (ms)

function memHit(key: string, limit: number, windowMs: number): HitResult {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return { ok: false, count: recent.length, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 20000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return { ok: true, count: recent.length, retryAfterSeconds: 0 };
}

// ---- shared mode ----
let lastCleanup = 0;
async function cleanupSometimes(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanup < 10 * 60_000) return;
  lastCleanup = now;
  try {
    // events older than a day can no longer be inside any window; expired blocks are no longer needed
    await prisma.rateEvent.deleteMany({ where: { at: { lt: new Date(now - 24 * 3600_000) }, OR: [{ until: null }, { until: { lt: new Date(now) } }] } });
  } catch { /* housekeeping only */ }
}

async function sharedHit(key: string, limit: number, windowMs: number): Promise<HitResult> {
  const now = Date.now();
  const since = new Date(now - windowMs);
  const rows = await prisma.rateEvent.findMany({ where: { key, at: { gte: since } }, orderBy: { at: "asc" }, select: { at: true }, take: limit });
  if (rows.length >= limit) {
    return { ok: false, count: rows.length, retryAfterSeconds: Math.max(1, Math.ceil((rows[0].at.getTime() + windowMs - now) / 1000)) };
  }
  await prisma.rateEvent.create({ data: { key } });
  void cleanupSometimes();
  return { ok: true, count: rows.length + 1, retryAfterSeconds: 0 };
}

/** Counts one event for `key` and says whether it is within `limit` events per `windowMs`. A refused event is not counted. */
export async function rateHit(key: string, limit: number, windowMs: number): Promise<HitResult> {
  return isSharedMode() ? sharedHit(key, limit, windowMs) : memHit(key, limit, windowMs);
}

// ---- failure counting with a temporary block (sign-in and join-code attempts) ----
export async function blockedFor(keys: string[]): Promise<number> {
  const now = Date.now();
  if (!isSharedMode()) {
    let wait = 0;
    for (const k of keys) { const until = blocks.get(k) ?? 0; if (until > now) wait = Math.max(wait, until - now); }
    return wait;
  }
  const rows = await prisma.rateEvent.findMany({ where: { key: { in: keys.map((k) => `block:${k}`) }, until: { gt: new Date(now) } }, select: { until: true } });
  return rows.reduce((w, r) => Math.max(w, (r.until?.getTime() ?? 0) - now), 0);
}

/** Records one failure for each key; when a key reaches its limit inside the window it is blocked for `blockMs`. */
export async function recordFailures(keys: string[], limitFor: (key: string) => number, windowMs: number, blockMs: number): Promise<void> {
  const now = Date.now();
  if (!isSharedMode()) {
    for (const k of keys) {
      const recent = (hits.get(`fail:${k}`) ?? []).filter((t) => now - t < windowMs);
      recent.push(now);
      if (recent.length >= limitFor(k)) { blocks.set(k, now + blockMs); hits.set(`fail:${k}`, []); } else hits.set(`fail:${k}`, recent);
    }
    if (blocks.size > 5000) for (const [k, until] of blocks) if (until < now) blocks.delete(k);
    return;
  }
  for (const k of keys) {
    await prisma.rateEvent.create({ data: { key: `fail:${k}` } });
    const n = await prisma.rateEvent.count({ where: { key: `fail:${k}`, at: { gte: new Date(now - windowMs) } } });
    if (n >= limitFor(k)) {
      await prisma.rateEvent.create({ data: { key: `block:${k}`, until: new Date(now + blockMs) } });
      await prisma.rateEvent.deleteMany({ where: { key: `fail:${k}` } });
    }
  }
  void cleanupSometimes();
}

export async function clearFailures(keys: string[]): Promise<void> {
  if (!isSharedMode()) { for (const k of keys) { blocks.delete(k); hits.delete(`fail:${k}`); } return; }
  await prisma.rateEvent.deleteMany({ where: { key: { in: keys.flatMap((k) => [`fail:${k}`, `block:${k}`]) } } });
}

/** Test hook: forget every counter (memory mode only; the shared table is cleared by deleting its rows). */
export function resetMemoryRateStore(prefix?: string): void {
  if (!prefix) { hits.clear(); blocks.clear(); return; }
  for (const k of [...hits.keys()]) if (k.startsWith(prefix)) hits.delete(k);
  for (const k of [...blocks.keys()]) if (k.startsWith(prefix)) blocks.delete(k);
}

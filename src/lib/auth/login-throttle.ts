/**
 * Login/password brute-force throttling (in-memory sliding window).
 * Per process: behind several instances the limit is per instance. Replace with a shared store (Redis/DB)
 * when scaling out horizontally.
 */

interface Bucket {
  failures: number[];
  blockedUntil: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
/** Failures allowed per window, by key prefix. */
const LIMITS: Record<string, number> = { "email:": 8, "ip:": 40, "join-user:": 10, "join-ip:": 40 };

const buckets = new Map<string, Bucket>();

function bucket(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = { failures: [], blockedUntil: 0 };
    buckets.set(key, b);
  }
  return b;
}

function limitFor(key: string) {
  const prefix = Object.keys(LIMITS).find((p) => key.startsWith(p));
  return prefix ? LIMITS[prefix] : 40;
}

export function checkLoginThrottle(keys: string[]): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  let wait = 0;
  for (const key of keys) {
    const b = buckets.get(key);
    if (b && b.blockedUntil > now) wait = Math.max(wait, b.blockedUntil - now);
  }
  return { allowed: wait === 0, retryAfterSeconds: Math.ceil(wait / 1000) };
}

export function recordLoginFailure(keys: string[]): void {
  const now = Date.now();
  for (const key of keys) {
    const b = bucket(key);
    b.failures = b.failures.filter((t) => now - t < WINDOW_MS);
    b.failures.push(now);
    if (b.failures.length >= limitFor(key)) {
      b.blockedUntil = now + BLOCK_MS;
      b.failures = [];
    }
  }
  // Opportunistic cleanup so the map cannot grow without bound.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.blockedUntil < now && v.failures.length === 0) buckets.delete(k);
  }
}

export function clearLoginFailures(keys: string[]): void {
  for (const key of keys) buckets.delete(key);
}

export function resetLoginThrottle(): void {
  buckets.clear();
}

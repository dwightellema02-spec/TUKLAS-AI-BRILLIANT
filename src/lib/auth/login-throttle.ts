/**
 * Login/password brute-force throttling (sliding window).
 * Counters live in src/lib/rate-store.ts: in this process's memory on a single server, in the shared database on a serverless host
 * (Phase 48), where a lockout must hold across instances.
 */
import { blockedFor, clearFailures, recordFailures, resetMemoryRateStore } from "../rate-store";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
/** Failures allowed per window, by key prefix. */
const LIMITS: Record<string, number> = { "email:": 8, "ip:": 40, "join-user:": 10, "join-ip:": 40 };

function limitFor(key: string) {
  const prefix = Object.keys(LIMITS).find((p) => key.startsWith(p));
  return prefix ? LIMITS[prefix] : 40;
}

export async function checkLoginThrottle(keys: string[]): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const wait = await blockedFor(keys);
  return { allowed: wait <= 0, retryAfterSeconds: Math.ceil(Math.max(0, wait) / 1000) };
}

export async function recordLoginFailure(keys: string[]): Promise<void> {
  await recordFailures(keys, limitFor, WINDOW_MS, BLOCK_MS);
}

export async function clearLoginFailures(keys: string[]): Promise<void> {
  await clearFailures(keys);
}

export function resetLoginThrottle(): void {
  resetMemoryRateStore();
}

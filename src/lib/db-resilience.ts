/**
 * Phase 47: a database that is asleep or restarting.
 * Hosted databases on free plans (Neon) pause when idle and need a few seconds to wake; a database or network can also blip for a moment.
 * Without this, the first request after a pause failed with an error. Now a request that could not reach the database is tried again a few
 * times, for a limited total time, and only when trying again is safe:
 *   - the database could not be reached at all (nothing was sent): any operation may be tried again;
 *   - the connection was closed under us (the query may or may not have run): only READS are tried again, never writes.
 * Everything else (a duplicate key, a bad value, a missing row) is a real answer and is never retried.
 */

/** Prisma operation names that only read. Raw SQL is treated as a read only when asked for with $queryRaw. */
const READS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "$queryRaw", "$queryRawUnsafe"]);

/** Codes meaning the database was never reached: P1001 cannot reach, P1002 timed out reaching, P2024 no connection became free in time. */
const NOT_REACHED_CODES = new Set(["P1001", "P1002", "P2024"]);
/** Codes meaning a connection existed and was closed: P1017 server closed the connection. */
const CLOSED_CODES = new Set(["P1017", "P1008"]);

const NOT_REACHED_TEXT = /can't reach database server|Timed out fetching a new connection|connection refused|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timed out trying to connect/i;
const CLOSED_TEXT = /server has closed the connection|connection terminated|ECONNRESET|connection reset|socket hang up|Error in PostgreSQL connection/i;

export type FailureKind = "not-reached" | "closed" | "other";

export function classifyDbError(e: unknown): FailureKind {
  const code = (e as any)?.code as string | undefined;
  const text = `${(e as any)?.message ?? ""} ${(e as any)?.meta?.message ?? ""}`;
  if (code && NOT_REACHED_CODES.has(code)) return "not-reached";
  if (code && CLOSED_CODES.has(code)) return "closed";
  // a connection that could not even be opened at start-up is a PrismaClientInitializationError without a useful code
  if ((e as any)?.name === "PrismaClientInitializationError" && NOT_REACHED_TEXT.test(text)) return "not-reached";
  if (NOT_REACHED_TEXT.test(text)) return "not-reached";
  if (CLOSED_TEXT.test(text)) return "closed";
  return "other";
}

export function isRetryable(kind: FailureKind, operation: string): boolean {
  if (kind === "not-reached") return true;
  if (kind === "closed") return READS.has(operation);
  return false;
}

export interface RetryOptions {
  /** Total time to keep trying, in milliseconds. */
  budgetMs?: number;
  /** Pause before each new attempt; the last value repeats. */
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (line: string) => void;
}

export const DEFAULT_BUDGET_MS = (() => {
  const n = Number(process.env.DB_RETRY_BUDGET_MS);
  return Number.isFinite(n) && n >= 0 && n <= 60000 ? n : 12000;
})();
const DEFAULT_DELAYS = [250, 500, 1000];
/** Connections that were cut leave dead ones in the pool and each attempt discards only one, so the first retries after a cut are immediate. */
const FLUSH_ATTEMPTS = 8;

export async function withDbRetry<T>(run: () => Promise<T>, operation: string, o: RetryOptions = {}): Promise<T> {
  const budget = o.budgetMs ?? DEFAULT_BUDGET_MS;
  const delays = o.delaysMs ?? DEFAULT_DELAYS;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = o.now ?? Date.now;
  const started = now();
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (e) {
      const kind = classifyDbError(e);
      const wait = kind === "closed" && attempt < FLUSH_ATTEMPTS ? 0 : delays[Math.min(attempt, delays.length - 1)];
      if (!isRetryable(kind, operation) || budget <= 0 || now() - started + wait > budget) {
        if (attempt > 0) o.log?.(`database still unavailable after ${attempt + 1} attempts (${operation}, ${kind})`);
        throw e;
      }
      if (attempt === 0) o.log?.(`database not reachable (${kind}); trying again for up to ${Math.round(budget / 1000)} s`);
      await sleep(wait);
    }
  }
}

/**
 * Settings that make a hosted database that sleeps work well, added to the address unless it already sets them:
 *   connect_timeout   long enough for a sleeping database to wake (the default is short)
 *   connection_limit  a small pool: a free-plan database allows few connections, and fewer dead ones to discard after a cut
 *   max_idle_connection_lifetime  close idle connections ourselves before the host suspends the database, so none are dead when it wakes
 */
export function withConnectionSettings(url: string | undefined, env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url;
  try {
    const u = new URL(url);
    const idle = Number(env.DB_MAX_IDLE_CONNECTION_SECONDS);
    const limit = Number(env.DB_CONNECTION_LIMIT);
    const defaults: Record<string, string> = {
      connect_timeout: "15",
      connection_limit: String(Number.isFinite(limit) && limit >= 1 && limit <= 50 ? limit : 5),
      max_idle_connection_lifetime: String(Number.isFinite(idle) && idle >= 1 && idle <= 3600 ? idle : 120),
    };
    for (const [k, v] of Object.entries(defaults)) if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    return u.toString();
  } catch {
    return url;
  }
}

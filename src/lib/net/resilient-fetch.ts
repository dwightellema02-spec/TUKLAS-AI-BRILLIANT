/**
 * Phase 47: a request to the API that fails because the server is waking up, restarting or cannot reach its database should be tried again
 * for a little while instead of showing the person an error or signing them out.
 *
 *   - Reads (GET/HEAD) are tried again on a network error or a 502/503/504.
 *   - Writes are tried again ONLY when the server says it did not process them (503 with code DATABASE_UNAVAILABLE). A write that failed
 *     with a network error is never repeated: it might have been applied.
 *   - Everything that is not under /api/ is left alone, and a real answer (200, 400, 401, 403, 404, 409, 429, 500) is returned as it is.
 * While it waits, `onWaiting(true)` lets the page show a "reconnecting" notice.
 */

export interface ResilientOptions {
  /** Total time to keep trying a read, in milliseconds. */
  readBudgetMs?: number;
  /** Total time to keep trying a write the server said it did not process. */
  writeBudgetMs?: number;
  delaysMs?: number[];
  sleep?: (ms: number, signal?: AbortSignal | null) => Promise<void>;
  now?: () => number;
  onWaiting?: (waiting: boolean) => void;
}

const RETRY_STATUS = new Set([502, 503, 504]);

const defaultSleep = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });

function pathOf(input: RequestInfo | URL): string | undefined {
  try {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(raw, typeof location !== "undefined" ? location.origin : "http://localhost");
    if (typeof location !== "undefined" && u.origin !== location.origin) return undefined;
    return u.pathname;
  } catch {
    return undefined;
  }
}

async function databaseUnavailable(res: Response): Promise<boolean> {
  if (res.status !== 503) return false;
  try { return (await res.clone().json())?.code === "DATABASE_UNAVAILABLE"; } catch { return false; }
}

export function createResilientFetch(inner: typeof fetch, o: ResilientOptions = {}): typeof fetch {
  const readBudget = o.readBudgetMs ?? 45_000;
  const writeBudget = o.writeBudgetMs ?? 15_000;
  const delays = o.delaysMs ?? [1000, 2000, 3000, 5000, 5000];
  const sleep = o.sleep ?? defaultSleep;
  const now = o.now ?? Date.now;
  let waiting = 0;
  const setWaiting = (on: boolean) => {
    const before = waiting > 0;
    waiting = Math.max(0, waiting + (on ? 1 : -1));
    if ((waiting > 0) !== before) o.onWaiting?.(waiting > 0);
  };

  return async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const path = pathOf(input);
    if (!path || !path.startsWith("/api/")) return inner(input, init);
    const method = (init?.method ?? (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET") ?? "GET").toUpperCase();
    const isRead = method === "GET" || method === "HEAD";
    const budget = isRead ? readBudget : writeBudget;
    const signal = init?.signal ?? (typeof input !== "string" && !(input instanceof URL) ? input.signal : null);
    const started = now();
    let counted = false;
    try {
      for (let attempt = 0; ; attempt++) {
        let res: Response | undefined;
        let networkError: unknown;
        try {
          res = await inner(input, init);
        } catch (e) {
          if ((e as any)?.name === "AbortError") throw e;
          networkError = e;
        }
        const retryable = res
          ? isRead ? RETRY_STATUS.has(res.status) : await databaseUnavailable(res)
          : isRead; // a write that failed with a network error is never repeated
        const wait = delays[Math.min(attempt, delays.length - 1)];
        if (!retryable || now() - started + wait > budget) {
          if (res) return res;
          throw networkError;
        }
        if (!counted) { counted = true; setWaiting(true); }
        await sleep(wait, signal);
      }
    } finally {
      if (counted) setWaiting(false);
    }
  } as typeof fetch;
}

// ---- the page-wide notice -------------------------------------------------------------------------------------------------------------
type Listener = () => void;
let waitingNow = false;
const listeners = new Set<Listener>();
export const connectionState = {
  get waiting() { return waitingNow; },
  set(v: boolean) { if (v !== waitingNow) { waitingNow = v; listeners.forEach((l) => l()); } },
  subscribe(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; },
};

let installed = false;
export function installResilientFetch(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;
  window.fetch = createResilientFetch(window.fetch.bind(window), { onWaiting: (w) => connectionState.set(w) });
}

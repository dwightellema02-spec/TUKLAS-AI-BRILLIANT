/**
 * Phase 46: a small watcher for /api/ready, so someone is told when the app cannot do its job (the database is down, a migration is half
 * applied). Pure logic with injected I/O so it can be tested; scripts/monitor-ready.ts is the command line around it.
 *
 * "Not ready" is any of: no answer within the timeout, a network error, a non-200 status, or an answer that does not say ready:true.
 * One alert is sent when the failures in a row reach the threshold, nothing more while it stays down, and one "recovered" message after.
 */
export interface MonitorOptions {
  url: string;
  timeoutMs: number;
  failuresBeforeAlert: number;
  /** Called with the text to send; failures here must never stop the monitor. */
  notify?: (text: string) => Promise<void>;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
}

export interface CheckResult { ready: boolean; detail: string }

export async function checkReady(url: string, timeoutMs: number, fetchImpl: typeof fetch = fetch): Promise<CheckResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: controller.signal, headers: { "cache-control": "no-store" } });
    if (res.status !== 200) return { ready: false, detail: `HTTP ${res.status}` };
    const body: any = await res.json().catch(() => null);
    return body?.ready === true ? { ready: true, detail: "ready" } : { ready: false, detail: "HTTP 200 but the answer does not say ready" };
  } catch (e) {
    const aborted = controller.signal.aborted;
    return { ready: false, detail: aborted ? `no answer within ${timeoutMs} ms` : `cannot connect (${(e as any)?.cause?.code ?? (e as any)?.code ?? "network error"})` };
  } finally {
    clearTimeout(timer);
  }
}

export function createMonitor(o: MonitorOptions) {
  let failures = 0;
  let alerted = false;
  const log = o.log ?? (() => undefined);
  const safeNotify = async (text: string) => {
    try { await o.notify?.(text); } catch (e) { log(`could not send the alert: ${(e as Error).message}`); }
  };
  return {
    get failures() { return failures; },
    get alerted() { return alerted; },
    async tick(): Promise<CheckResult & { sent?: "alert" | "recovered" }> {
      const r = await checkReady(o.url, o.timeoutMs, o.fetchImpl);
      if (r.ready) {
        const wasAlerted = alerted;
        failures = 0; alerted = false;
        if (wasAlerted) { await safeNotify("Tuklas AI is ready again."); return { ...r, sent: "recovered" }; }
        return r;
      }
      failures++;
      if (failures >= o.failuresBeforeAlert && !alerted) {
        alerted = true;
        await safeNotify(`Tuklas AI is NOT ready (${r.detail}) after ${failures} checks in a row. Students cannot use it until this is fixed. See docs/RUNBOOK.md, section "When something is wrong".`);
        return { ...r, sent: "alert" };
      }
      return r;
    },
  };
}

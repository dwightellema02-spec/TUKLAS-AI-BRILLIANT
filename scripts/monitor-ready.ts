/**
 * Watches /api/ready and tells someone when it stays down. Run it somewhere that is NOT the app itself (a second small machine, or the
 * host's scheduler), or use a hosted uptime service pointed at /api/ready instead (see docs/RUNBOOK.md).
 *
 *   npx tsx scripts/monitor-ready.ts --once          one check; exit 0 = ready, 1 = not ready (for cron / schedulers)
 *   npx tsx scripts/monitor-ready.ts                  keep watching, one check every MONITOR_INTERVAL_SECONDS
 *
 * Settings (environment):
 *   MONITOR_URL                     default http://127.0.0.1:$PORT/api/ready (use the public https address when watching from elsewhere)
 *   MONITOR_INTERVAL_SECONDS        default 60
 *   MONITOR_TIMEOUT_MS              default 5000
 *   MONITOR_FAILURES_BEFORE_ALERT   default 3 (checks in a row)
 *   MONITOR_ALERT_WEBHOOK           optional https URL that receives {"text": "...", "content": "..."} (Slack / Teams / Discord style); never printed
 */
import { createMonitor, checkReady } from "./lib/ready-monitor";

const num = (name: string, fallback: number, min: number, max: number) => {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) { console.error(`${name} must be a number between ${min} and ${max}.`); process.exit(2); }
  return n;
};

const url = process.env.MONITOR_URL || `http://127.0.0.1:${process.env.PORT || 3000}/api/ready`;
const timeoutMs = num("MONITOR_TIMEOUT_MS", 5000, 500, 60000);
const intervalS = num("MONITOR_INTERVAL_SECONDS", 60, 1, 3600);
const failuresBeforeAlert = num("MONITOR_FAILURES_BEFORE_ALERT", 3, 1, 100);
const webhook = (process.env.MONITOR_ALERT_WEBHOOK ?? "").trim();
if (webhook) {
  let ok = false;
  try { const u = new URL(webhook); ok = u.protocol === "https:" || (u.protocol === "http:" && ["127.0.0.1", "localhost"].includes(u.hostname)); } catch { /* invalid */ }
  if (!ok) { console.error("MONITOR_ALERT_WEBHOOK must be an https:// address."); process.exit(2); }
}
const stamp = () => new Date().toISOString();

async function notify(text: string) {
  console.log(`${stamp()} ALERT: ${text}`);
  if (!webhook) return;
  const res = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, content: text }), signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`the alert address answered HTTP ${res.status}`);
}

async function main() {
  if (process.argv.includes("--once")) {
    const r = await checkReady(url, timeoutMs);
    console.log(`${stamp()} ${r.ready ? "READY" : "NOT READY"}: ${r.detail}`);
    process.exit(r.ready ? 0 : 1);
  }
  const monitor = createMonitor({ url, timeoutMs, failuresBeforeAlert, notify, log: (l) => console.error(`${stamp()} ${l}`) });
  console.log(`${stamp()} watching ${new URL(url).origin}/api/ready every ${intervalS}s; alert after ${failuresBeforeAlert} failed checks${webhook ? " (webhook set)" : " (no webhook: alerts are only printed)"}`);
  const stop = () => { console.log(`${stamp()} stopped`); process.exit(0); };
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
  for (;;) {
    const r = await monitor.tick();
    if (!r.ready) console.log(`${stamp()} not ready (${monitor.failures} in a row): ${r.detail}`);
    await new Promise((res) => setTimeout(res, intervalS * 1000));
  }
}
main().catch((e) => { console.error("monitor crashed:", e); process.exit(2); });

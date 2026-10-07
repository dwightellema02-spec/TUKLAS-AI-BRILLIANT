/**
 * Tuklas AI - Phase 46: the /api/ready watcher. Unit tests with injected network + a real server, a real webhook receiver and the real CLI.
 *   AI_PROVIDER=local npx tsx scripts/test-phase46-monitor.ts
 */
import crypto from "crypto";
import http from "http";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { checkReady, createMonitor } from "./lib/ready-monitor";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);
const resp = (status: number, body: unknown): any => ({ status, json: async () => body });

async function main() {
  section("1. What counts as ready");
  const f = (impl: () => Promise<any>) => impl as unknown as typeof fetch;
  assert((await checkReady("http://x/ready", 500, f(async () => resp(200, { ready: true })))).ready, "200 with ready:true is ready");
  assert(!(await checkReady("http://x/ready", 500, f(async () => resp(503, { ready: false })))).ready, "503 is not ready");
  const odd = await checkReady("http://x/ready", 500, f(async () => resp(200, { status: "ok" })));
  assert(!odd.ready && /does not say ready/.test(odd.detail), "200 without ready:true (a proxy's own page, a wrong address) is NOT ready");
  assert(!(await checkReady("http://x/ready", 500, f(async () => ({ status: 200, json: async () => { throw new Error("not json"); } })))).ready, "200 with a body that is not JSON is not ready");
  const refused = await checkReady("http://x/ready", 500, f(async () => { const e: any = new TypeError("fetch failed"); e.cause = { code: "ECONNREFUSED" }; throw e; }));
  assert(!refused.ready && /ECONNREFUSED/.test(refused.detail), `A refused connection is not ready, with the reason (${refused.detail})`);
  const slow = await checkReady("http://x/ready", 100, (async (_u: any, init: any) => new Promise((_res, rej) => { init.signal.addEventListener("abort", () => rej(new Error("aborted"))); })) as any);
  assert(!slow.ready && /no answer within 100 ms/.test(slow.detail), "No answer within the timeout is not ready");

  section("2. When to alert");
  const sent: string[] = [];
  let state: "up" | "down" = "up";
  const mon = createMonitor({ url: "http://x/ready", timeoutMs: 500, failuresBeforeAlert: 3, notify: async (t) => { sent.push(t); }, fetchImpl: f(async () => (state === "up" ? resp(200, { ready: true }) : resp(503, { ready: false }))) });
  await mon.tick(); await mon.tick();
  assert(sent.length === 0, "While it is ready, nothing is sent");
  state = "down";
  await mon.tick(); await mon.tick();
  assert(sent.length === 0 && mon.failures === 2, "Two failures in a row: still nothing (a restart or a slow moment is not an emergency)");
  const third = await mon.tick();
  assert(sent.length === 1 && third.sent === "alert" && /NOT ready/.test(sent[0]) && /RUNBOOK/.test(sent[0]), "The third failure in a row sends exactly one alert that says where to look");
  await mon.tick(); await mon.tick(); await mon.tick();
  assert(sent.length === 1, "While it stays down there are no repeats");
  state = "up";
  const rec = await mon.tick();
  assert(sent.length === 2 && rec.sent === "recovered" && /ready again/.test(sent[1]) && mon.failures === 0, "When it comes back, one 'ready again' message");
  await mon.tick();
  assert(sent.length === 2, "...and nothing after that");
  state = "down"; await mon.tick(); state = "up"; await mon.tick(); state = "down"; await mon.tick(); await mon.tick();
  assert(sent.length === 2, "A blip that recovers resets the count (down, up, down, down does not alert)");
  await mon.tick();
  assert(sent.length === 3, "...but three in a row after that does");

  section("3. A broken alert channel never stops the watching");
  let calls = 0; const logs: string[] = [];
  const bad = createMonitor({ url: "http://x/ready", timeoutMs: 500, failuresBeforeAlert: 1, notify: async () => { calls++; throw new Error("webhook down"); }, fetchImpl: f(async () => resp(503, {})), log: (l) => logs.push(l) });
  await bad.tick(); await bad.tick();
  assert(calls === 1 && bad.alerted && logs.some((l) => /could not send the alert/.test(l)), "A failing webhook is logged, the monitor goes on, and it does not hammer the webhook every check");

  section("4. The real command line against a real server");
  const port = 7900 + Math.floor(Math.random() * 90);
  const whPort = port + 100;
  const received: any[] = [];
  const hook = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => { try { received.push(JSON.parse(b)); } catch { /* */ } res.end("ok"); }); });
  await new Promise<void>((r) => hook.listen(whPort, "127.0.0.1", r));
  const env = { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex"), DATABASE_URL: "" };
  const startServer = (): ChildProcess => spawn("npx", ["tsx", "server.ts"], { env, stdio: "ignore", detached: true });
  const stopServer = async (p: ChildProcess) => { try { process.kill(-p.pid!, "SIGKILL"); } catch { /* */ } await new Promise((r) => setTimeout(r, 800)); };
  const waitUp = async () => { for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`http://127.0.0.1:${port}/api/ready`)).ok) return true; } catch { /* */ } } return false; };
  const cli = (args: string[], extra: Record<string, string> = {}) => spawnSync("npx", ["tsx", "scripts/monitor-ready.ts", ...args], { env: { ...env, ...extra }, encoding: "utf-8", timeout: 60000 });
  let server = startServer();
  let loop: ChildProcess | undefined;
  try {
    assert(await waitUp(), "(setup) the server is up");
    const once = cli(["--once"]);
    assert(once.status === 0 && /READY/.test(once.stdout), "--once on a ready server exits 0");
    assert(cli([], { MONITOR_ALERT_WEBHOOK: "http://evil.example/hook" }).status === 2, "A plain-http webhook to another host is refused at start");
    assert(cli([], { MONITOR_INTERVAL_SECONDS: "abc" }).status === 2, "A nonsense setting is refused at start");

    loop = spawn("npx", ["tsx", "scripts/monitor-ready.ts"], { env: { ...env, MONITOR_INTERVAL_SECONDS: "1", MONITOR_FAILURES_BEFORE_ALERT: "2", MONITOR_TIMEOUT_MS: "1500", MONITOR_ALERT_WEBHOOK: `http://127.0.0.1:${whPort}/hook` }, stdio: ["ignore", "pipe", "pipe"], detached: true });
    let out = ""; loop.stdout?.on("data", (d) => (out += d)); loop.stderr?.on("data", (d) => (out += d));
    await new Promise((r) => setTimeout(r, 4000));
    assert(received.length === 0, "While the server is up nothing is sent");
    await stopServer(server);
    for (let i = 0; i < 40 && received.length === 0; i++) await new Promise((r) => setTimeout(r, 500));
    assert(received.length === 1 && /NOT ready/.test(received[0].text) && received[0].content === received[0].text, "Stop the server: the webhook gets one alert (Slack-style text and Discord-style content)");
    await new Promise((r) => setTimeout(r, 4000));
    assert(received.length === 1, "...and no repeats while it stays down");
    server = startServer();
    assert(await waitUp(), "(setup) the server is back");
    for (let i = 0; i < 40 && received.length < 2; i++) await new Promise((r) => setTimeout(r, 500));
    assert(received.length === 2 && /ready again/.test(received[1].text), "Restart it: one 'ready again' message");
    assert(!out.includes(`${whPort}`) && !out.includes("/hook"), "The webhook address is never printed in the monitor's output");
    assert(cli(["--once"], { PORT: String(port + 50) }).status === 1, "--once against nothing listening exits 1");
  } finally {
    if (loop?.pid) { try { process.kill(-loop.pid, "SIGTERM"); } catch { /* */ } }
    await stopServer(server);
    hook.close();
  }
  console.log(`\nPHASE 46 MONITOR RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

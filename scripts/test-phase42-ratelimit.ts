/**
 * Tuklas AI - Phase 42: request ceilings. Black-box over HTTP (in-memory store; limits set small through the same environment variables
 * production uses). Anonymous traffic is limited per address; signed-in traffic per account, so a shared school address is not throttled
 * for everyone because of one runaway tab.
 *   AI_PROVIDER=local npx tsx scripts/test-phase42-ratelimit.ts
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };

async function main() {
  const port = 7000 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
  let server: ChildProcess | undefined;
  const api = async (m: string, p: string, t?: string, b?: unknown) => {
    const r = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined });
    return { status: r.status, retryAfter: r.headers.get("retry-after"), json: await r.json().catch(() => ({})) as any };
  };
  try {
    server = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex"), API_RATE_LIMIT_PER_MINUTE: "30", API_RATE_LIMIT_USER_PER_MINUTE: "50", API_RATE_LIMIT_SIGNED_IN_IP_PER_MINUTE: "120" }, stdio: "ignore", detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    const run = crypto.randomBytes(3).toString("hex");
    const reg = async (tag: string) => (await api("POST", "/api/auth/register", undefined, { name: `S ${tag}`, email: `p42r.${tag}.${run}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    const A = await reg("a"), B = await reg("b"), C = await reg("c");

    console.log("--- signed-in traffic is limited per account ---");
    const a = []; for (let i = 0; i < 60; i++) a.push((await api("GET", "/api/skills", A)).status);
    assert(a.slice(0, 50).every((s) => s === 200) && a.slice(50).every((s) => s === 429), `Account A: the first 50 requests pass, the rest are refused (${a.filter((s) => s === 200).length} ok, ${a.filter((s) => s === 429).length} refused)`);
    const refused = await api("GET", "/api/skills", A);
    assert(refused.status === 429 && !!refused.retryAfter && /Too many/.test(refused.json.error), `The refusal says to wait (Retry-After ${refused.retryAfter})`);
    const b = await api("GET", "/api/skills", B);
    assert(b.status === 200, "Account B, from the same address, is not affected");
    assert((await api("GET", "/api/health")).status === 200 && (await api("GET", "/api/ready")).status === 200, "Health and readiness checks are never throttled");

    console.log("\n--- the shared address has a high ceiling for signed-in traffic ---");
    let throttledByIp = 0;
    for (let i = 0; i < 70; i++) { const r = await api("GET", "/api/skills", C); if (r.status === 429) throttledByIp++; } // 120 per address in the minute: A used 61, B 1, C 1 so far
    assert(throttledByIp > 0 && throttledByIp < 70, `Many accounts together can still be stopped at the address ceiling (${throttledByIp} of 70 refused)`);

    console.log("\n--- anonymous traffic is limited per address ---");
    const anon: number[] = [];
    for (let i = 0; i < 40; i++) anon.push((await api("POST", "/api/auth/login", undefined, { email: `nobody${i}@example.edu`, password: "wrong-pass-1" })).status);
    assert(anon.filter((s) => s === 429).length >= 8, `A flood of sign-in attempts from one address is refused after the ceiling (${anon.filter((s) => s === 429).length} of 40)`);
    assert(anon.slice(0, 5).every((s) => s !== 429), "...the first attempts were not");
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* */ } }
  }
  console.log(`\nPHASE 42 RATE-LIMIT RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

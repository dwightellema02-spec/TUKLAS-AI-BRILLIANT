/**
 * Tuklas AI - pre-deployment hardening checks (in-memory or PostgreSQL, black-box HTTP):
 *   - another student's practice session is indistinguishable from one that does not exist (404, not 500)
 *   - an over-long tutor message gets a clear 400, not a generic 500
 *   - the framework banner (X-Powered-By) is not sent
 *   AI_PROVIDER=local npx tsx scripts/test-phase44-hardening.ts
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
async function main() {
  const port = 7700 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
  const server: ChildProcess = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
  try {
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    const api = async (m: string, p: string, t?: string, b?: unknown) => { const r = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined }); return { status: r.status, json: await r.json().catch(() => ({})) as any, headers: r.headers }; };
    const run = crypto.randomBytes(3).toString("hex");
    const reg = async (t: string) => (await api("POST", "/api/auth/register", undefined, { name: `P ${t}`, email: `p44.${t}.${run}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    const A = await reg("a"), B = await reg("b");
    const sets = (await api("GET", "/api/practice-sets", A)).json.data as any[];
    const st = (await api("POST", "/api/practice/start", A, { practiceSetId: sets[0].id })).json.data;
    const q = st.questions[0].question ?? st.questions[0];
    assert((await api("GET", `/api/practice/${st.id}`, A)).status === 200, "The owner still reads their session");
    assert((await api("GET", `/api/practice/${st.id}`, B)).status === 404, "Another student reading it: 404");
    assert((await api("GET", `/api/practice/${st.id}/review`, B)).status === 404, "...its review: 404");
    assert((await api("POST", `/api/practice/${st.id}/complete`, B, {})).status === 404, "...completing it: 404");
    assert((await api("POST", `/api/practice/${st.id}/answer`, B, { questionId: q.id ?? q.questionId, answer: "1" })).status === 404, "...answering in it: 404");
    const missing = await api("GET", `/api/practice/does-not-exist`, B);
    assert(missing.status === 404, "A session that does not exist gives the same 404");
    assert((await api("POST", `/api/practice/${st.id}/answer`, A, { questionId: q.id ?? q.questionId, answer: "1" })).status === 200, "The owner can still answer");
    const long = await api("POST", "/api/ai/tutor", A, { practiceSessionId: st.id, questionId: q.id ?? q.questionId, studentQuery: "word ".repeat(400) });
    assert(long.status === 400 && /too long/.test(long.json.error) && /1,000/.test(long.json.error), "A message over 1,000 characters: 400 with a clear message");
    const ok = await api("POST", "/api/ai/tutor", A, { practiceSessionId: st.id, questionId: q.id ?? q.questionId, studentQuery: "I need a hint" });
    assert(ok.status === 200, "A normal message still works");
    assert((await fetch(base + "/api/health")).headers.get("x-powered-by") === null, "No X-Powered-By header");
  } finally { try { process.kill(-server.pid!, "SIGTERM"); } catch { /* */ } }
  console.log(`\nHARDENING RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

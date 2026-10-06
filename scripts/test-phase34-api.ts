/**
 * Tuklas AI - Phase 34: fixes found while walking the whole classroom journey. Black-box over HTTP.
 *   AI_PROVIDER=local npx tsx scripts/test-phase34-api.ts      (use DATABASE_URL via the PG wrapper for PostgreSQL)
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const run = crypto.randomBytes(3).toString("hex");
let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);

async function main() {
  const port = 5800 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
  let server: ChildProcess | undefined;
  const api = async (m: string, p: string, t?: string, b?: unknown) => {
    const r = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined });
    const text = await r.text(); let json: any = {}; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json, text };
  };
  try {
    server = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    const login = async (e: string, p: string) => (await api("POST", "/api/auth/login", undefined, { email: e, password: p })).json.token as string;
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await api("POST", "/api/admin/users", admin, { name: "T", email: `p34.t.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER" });
    const T = await login(`p34.t.${run}@example.edu`, "Sturdy-Pass1");
    const sr = await api("POST", "/api/auth/register", undefined, { name: "S", email: `p34.s.${run}@example.edu`, password: "Sturdy-Pass1" });
    const S = sr.json.token as string;

    section("1. Practice start: expected conditions are not server faults");
    assert((await api("POST", "/api/practice/start", S, { practiceSetId: "no-such-set" })).status === 404, "An unknown practice set -> 404 (was 500)");
    assert((await api("POST", "/api/practice/start", S, {})).status === 400, "No id -> 400");
    const q = (await api("POST", "/api/questions", T, { type: "NUMERIC_INPUT", prompt: `P34 ${run}`, status: "PUBLISHED", difficulty: "EASY", questionData: { correctAnswer: 2 } })).json.data.id;
    const draftSet = (await api("POST", "/api/practice-sets", T, { title: `P34 draft ${run}`, status: "DRAFT", questionIds: [q] })).json.data;
    assert((await api("POST", "/api/practice/start", S, { practiceSetId: draftSet.id })).status === 409, "An unpublished practice set -> 409 (was 500)");
    const emptySet = (await api("POST", "/api/practice-sets", T, { title: `P34 empty ${run}`, status: "PUBLISHED", questionIds: [] })).json.data;
    const emptyStart = await api("POST", "/api/practice/start", S, { practiceSetId: emptySet?.id });
    assert([409, 400].includes(emptyStart.status), `A practice set with no questions is refused cleanly (${emptyStart.status})`);

    section("2. Adaptive guidance never invents a skill");
    const rec = await api("GET", "/api/student/adaptive/recommendation", S);
    assert(rec.status === 200, `A brand-new student gets guidance (or none), never a server error (${rec.status})`);
    assert((await api("GET", "/api/student/adaptive/recommendation?skillId=skl_does_not_exist", S)).status === 404, "A skill id that does not exist -> 404 (was a database error)");
    assert((await api("POST", "/api/student/adaptive/recommendation/generate", S, { skillId: "skl_01_made_up_zz" })).status === 404, "Generating for a skill that does not exist -> 404");
    const gen = await api("POST", "/api/student/adaptive/recommendation/generate", S, {});
    assert(gen.status === 200, `Generating without a skill works (${gen.status})`);

    section("3. A practice-set assignment reaches the student with its id");
    const cls = (await api("POST", "/api/teacher/classes", T, { name: `P34 class ${run}`, gradeLevel: 7 })).json.data;
    const code = (await api("GET", `/api/teacher/classes/${cls.id}`, T)).json.data.classroom?.joinCode ?? cls.joinCode;
    await api("POST", "/api/student/classes/join", S, { code });
    const set = (await api("POST", "/api/practice-sets", T, { title: `P34 set ${run}`, status: "PUBLISHED", questionIds: [q] })).json.data;
    const asg = await api("POST", `/api/teacher/classes/${cls.id}/assignments`, T, { title: `P34 practice ${run}`, practiceSetId: set.id, dueDate: new Date(Date.now() + 86400000).toISOString() });
    assert(asg.status === 201 || asg.status === 200, `A teacher can assign a practice set (${asg.status})`);
    const mine = await api("GET", "/api/student/assignments", S);
    const row = mine.json.data?.find((x: any) => x.practiceSetId === set.id);
    assert(!!row && row.dueDate, "The student sees it with the practice-set id and due date");
    const started = await api("POST", "/api/practice/start", S, { practiceSetId: set.id });
    assert(started.status === 201, "...and can start it");
    assert((await api("POST", `/api/teacher/classes/${cls.id}/assignments`, T, { title: `bad ${run}`, practiceSetId: "nope" })).status === 404, "Assigning a practice set that does not exist is refused (404)");
    assert((await api("POST", `/api/teacher/classes/${cls.id}/assignments`, T, { title: `none ${run}` })).status === 400, "An assignment with neither lesson nor practice set is refused (400)");
  } finally { try { if (server?.pid) process.kill(-server.pid, "SIGTERM"); } catch { /* */ } }
  console.log(`\n======================================================\nPHASE 34 API RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

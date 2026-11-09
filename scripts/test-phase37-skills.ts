/**
 * Tuklas AI - Phase 37: a question's skill (validation, inheritance, filter). Black-box over HTTP.
 *   AI_PROVIDER=local npx tsx scripts/test-phase37-skills.ts     (use DATABASE_URL + the wrapper for PostgreSQL)
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
  const port = 6100 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
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
    await api("POST", "/api/admin/users", admin, { name: "T", email: `p37.t.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER", verifyMathematics: true });
    const T = await login(`p37.t.${run}@example.edu`, "Sturdy-Pass1");
    // Phase 51: attaching a question to someone else's lesson needs an administrator who is verified for Mathematics.
    await api("POST", "/api/admin/users", admin, { name: "A", email: `p37.a.${run}@example.edu`, password: "Sturdy-Pass1", role: "ADMIN", verifyMathematics: true });
    const adminV = await login(`p37.a.${run}@example.edu`, "Sturdy-Pass1");
    const S = (await api("POST", "/api/auth/register", undefined, { name: "S", email: `p37.s.${run}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    const skills = (await api("GET", "/api/skills", T)).json.data as any[];
    const skillA = skills[0].id as string, skillB = skills[1].id as string;
    const mk = (tok: string, body: any) => api("POST", "/api/questions", tok, { type: "NUMERIC_INPUT", prompt: `P37 ${Math.random()} ${run}`, status: "DRAFT", questionData: { correctAnswer: 1 }, ...body });

    section("1. Creating a question");
    const before = (await api("GET", "/api/questions", T)).json.data.length;
    assert((await mk(T, { skillId: "skl_does_not_exist" })).status === 400, "An unknown skill is refused (400), not a database error");
    assert((await mk(T, { skillId: 12345 })).status === 400 && (await mk(T, { skillId: { id: "x" } })).status === 400, "A skill that is not text is refused (400)");
    assert((await api("GET", "/api/questions", T)).json.data.length === before, "...and none of the refused requests created anything");
    const withSkill = await mk(T, { skillId: skillA });
    assert(withSkill.status === 201 && withSkill.json.data.skillId === skillA, "A valid skill is stored");
    const none = await mk(T, {});
    assert(none.status === 201 && !none.json.data.skillId, "No skill and no lesson: allowed, stored without a skill (flagged in the question bank)");
    assert((await mk(T, { skillId: "" })).json.data.skillId == null && (await mk(T, { skillId: null })).json.data.skillId == null, "An empty or null skill means 'none', not an error");

    section("2. A question attached to a lesson inherits the lesson's skill");
    const lessons = (await api("GET", "/api/lessons", admin)).json.data as any[];
    const lesson = lessons.find((l) => l.status === "PUBLISHED") ?? lessons[0];
    const detail = (await api("GET", `/api/lessons/${lesson.id}`, admin)).json.data;
    const lessonSkill = detail.skills?.[0]?.skillId ?? detail.skills?.[0]?.skill?.id ?? detail.skillIds?.[0];
    assert(!!lessonSkill, `(setup) the lesson has a skill (${lessonSkill})`);
    const inh = await mk(adminV, { lessonId: lesson.id });
    assert(inh.status === 201 && inh.json.data.skillId === lessonSkill, `No skill given: the lesson's first skill is used (${inh.json.data?.skillId})`);
    const other = skills.find((s) => s.id !== lessonSkill)!.id;
    const explicit = await mk(adminV, { lessonId: lesson.id, skillId: other });
    assert(explicit.json.data.skillId === other, "A skill the teacher chose is never overridden by the lesson's");
    assert((await mk(adminV, { lessonId: lesson.id, skillId: "nope" })).status === 400, "An unknown skill is refused even with a lesson");

    section("3. Editing");
    const q = withSkill.json.data.id as string;
    assert((await api("PATCH", `/api/questions/${q}`, T, { skillId: "nope" })).status === 400 && (await api("PUT", `/api/questions/${q}`, T, { skillId: "nope" })).status === 400, "PATCH and PUT with an unknown skill -> 400");
    assert((await api("GET", `/api/questions/${q}`, T)).json.data.skillId === skillA, "...and the stored skill is unchanged");
    assert((await api("PATCH", `/api/questions/${q}`, T, { skillId: skillB })).json.data.skillId === skillB, "A valid new skill is saved");
    assert((await api("PATCH", `/api/questions/${q}`, T, { prompt: `P37 edited ${run}` })).json.data.skillId === skillB, "Editing something else leaves the skill alone");
    assert((await api("PATCH", `/api/questions/${q}`, T, { skillId: null })).json.data.skillId == null, "A teacher can clear the skill");

    section("4. Finding questions with no skill");
    const noSkill = (await api("GET", "/api/questions?noSkill=true", T)).json.data as any[];
    const all = (await api("GET", "/api/questions", T)).json.data as any[];
    assert(noSkill.length > 0 && noSkill.every((x) => !x.skillId), `The 'no skill' filter returns only questions without one (${noSkill.length})`);
    assert(noSkill.some((x) => x.id === none.json.data.id) && !noSkill.some((x) => x.id === inh.json.data.id), "...including the one made above and not the inherited one");
    assert(all.length > noSkill.length, "Without the filter, skilled questions are included too");
    await api("PATCH", `/api/questions/${none.json.data.id}`, T, { status: "PUBLISHED" });
    const sAll = (await api("GET", "/api/questions", S)).json.data as any[], sFilt = (await api("GET", "/api/questions?noSkill=true", S)).json.data as any[];
    assert(sAll.length === sFilt.length, "The filter is a staff tool: a student asking for it gets the normal published list");
    assert(!/correctAnswer/.test(JSON.stringify(sFilt)), "(and still no answer keys)");
    assert((await api("GET", "/api/questions?noSkill=true", undefined)).status === 401, "Signed out -> 401");
  } finally { try { if (server?.pid) process.kill(-server.pid, "SIGTERM"); } catch { /* */ } }
  console.log(`\n======================================================\nPHASE 37 RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

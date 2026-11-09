/**
 * Tuklas AI - Phase 41: saving a lesson from the studio (sections, skills) and publishing it. Black-box over HTTP, both stores:
 *   AI_PROVIDER=local npx tsx scripts/test-phase41-lesson-save.ts                 (in-memory)
 *   DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase41-lesson-save.ts   (PostgreSQL)
 * In PostgreSQL mode a studio "Save Draft" used to answer "saved" and keep neither the sections nor the skills.
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p41s.${t}.${run}@example.edu`;
let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);

async function main() {
  const port = 6600 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
  let server: ChildProcess | undefined;
  const api = async (m: string, p: string, t?: string, b?: unknown) => {
    const r = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined });
    const text = await r.text(); let json: any = {}; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json };
  };
  try {
    server = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    console.log(`Server up (${DB_MODE ? "PostgreSQL" : "in-memory"} mode)`);
    const login = async (e: string, p: string) => (await api("POST", "/api/auth/login", undefined, { email: e, password: p })).json.token as string;
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const t of ["t1", "t2"]) await api("POST", "/api/admin/users", admin, { name: `Teacher ${t}`, email: email(t), password: PASSWORD, role: "TEACHER", verifyMathematics: true });
    const T1 = await login(email("t1"), PASSWORD), T2 = await login(email("t2"), PASSWORD);
    const unit = ((await api("GET", "/api/curriculum", T1)).json.data[0].grades[0].terms as any[]).flatMap((t) => t.units)[0];
    const skills = (await api("GET", "/api/skills", T1)).json.data as any[];
    const [sk1, sk2] = [skills[0].id as string, skills[1].id as string];
    const mkBlock = (type: string, title: string, content: string, metadata?: unknown) => ({ type, title, content, sequenceOrder: 1, ...(metadata ? { metadata: JSON.stringify(metadata) } : {}) });
    const cp = (q: string) => mkBlock("CHECKPOINT", "Quick check", q, { question: q, options: ["A", "B"], correctAnswer: "A", explanation: "Because." });
    const lesson = (await api("POST", "/api/lessons", T1, { title: `P41S ${run}`, unitId: unit.id, learningObjectives: ["x"] })).json.data;
    const get = async () => (await api("GET", `/api/lessons/${lesson.id}`, T1)).json.data;
    const save = (body: unknown, tok = T1) => api("PUT", `/api/lessons/${lesson.id}`, tok, body);

    section("1. Save Draft keeps the sections and the skills");
    const r1 = await save({ title: `P41S ${run} v1`, description: "d", learningObjectives: ["o"], estimatedMinutes: 30, contentBlocks: [mkBlock("TEXT", "Intro", "Hello $x$"), cp("Pick A"), mkBlock("SUMMARY", "Recap", "Done")], skillIds: [sk1] });
    assert(r1.status === 200, `The save is accepted (${r1.status})`);
    let l = await get();
    assert(l.contentBlocks.length === 3 && l.contentBlocks.map((b: any) => b.type).join() === "TEXT,CHECKPOINT,SUMMARY", `All three sections are kept, in order (${l.contentBlocks.length})`);
    assert(l.contentBlocks.map((b: any) => b.sequenceOrder).join() === "1,2,3", "Their places are 1, 2, 3");
    assert(l.title.endsWith("v1") && l.estimatedMinutes === 30, "The other fields are saved too");
    assert((l.skills ?? []).map((s: any) => s.skillId ?? s.skill?.id).join() === sk1 || (l.skillIds ?? []).join() === sk1, "The chosen skill is kept");
    assert(!!(r1.json.data.contentBlocks ?? []).length, "The save's own response shows the saved sections (the studio displays it)");

    section("2. Saving again edits, reorders, adds and removes");
    const ids = l.contentBlocks.map((b: any) => b.id);
    const edited = [{ ...l.contentBlocks[1], content: "Edited prompt", title: "Edited check" }, l.contentBlocks[0], mkBlock("HINT", "New hint", "A tip")];
    const r2 = await save({ contentBlocks: edited, skillIds: [sk1, sk2] });
    assert(r2.status === 200, "Second save accepted");
    l = await get();
    assert(l.contentBlocks.map((b: any) => b.title).join("|") === "Edited check|Intro|New hint", `Order, edits and the new section are saved (${l.contentBlocks.map((b: any) => b.title).join("|")})`);
    assert(l.contentBlocks.length === 3, "The section that was left out (the summary) is gone");
    if (DB_MODE) assert(l.contentBlocks[0].id === ids[1] && l.contentBlocks[1].id === ids[0], "Sections that were kept keep their id (students' answers and progress point at it)");
    assert(new Set((l.skills ?? []).map((s: any) => s.skillId ?? s.skill?.id)).size === 2, "A second skill is added");
    await save({ skillIds: [] });
    assert(((await get()).skills ?? []).length === 0, "An empty list of skills clears them");
    assert((await save({ title: `P41S ${run} v3` })).status === 200 && (await get()).contentBlocks.length === 3, "A save that does not mention sections leaves them alone");
    await save({ contentBlocks: [] });
    assert((await get()).contentBlocks.length === 0, "An empty list removes every section");

    section("3. What is refused");
    if (DB_MODE) {
      assert((await save({ contentBlocks: [{ type: "NOPE", content: "x" }] })).status === 400, "Unknown section type: 400");
      assert((await save({ contentBlocks: [{ type: "TEXT", content: 5 }] })).status === 400, "Content that is not text: 400");
      assert((await save({ contentBlocks: "x" })).status === 400 && (await save({ contentBlocks: null })).status === 400, "Sections that are not a list: 400");
      assert((await save({ contentBlocks: Array.from({ length: 201 }, () => mkBlock("TEXT", "t", "c")) })).status === 400, "More than 200 sections: 400");
      assert((await save({ skillIds: ["no-such-skill"] })).status === 400 && (await save({ skillIds: [1] })).status === 400, "An unknown or non-text skill id: 400");
      await save({ contentBlocks: [mkBlock("TEXT", "Keep", "kept")] });
      await save({ contentBlocks: [{ type: "NOPE", content: "x" }] });
      assert((await get()).contentBlocks.length === 1, "A refused save changes nothing");
    }
    assert((await save({ title: "Hijack" }, T2)).status === 403, "Another teacher cannot save my lesson: 403");

    section("4. Publishing: unfinished template text is refused");
    await save({ contentBlocks: [mkBlock("TEXT", "Concept Explanation", "(Replace this text) Explain the concept here."), mkBlock("TEXT", "Real", "Real content")] });
    for (const st of ["REVIEW", "APPROVED"]) await api("POST", `/api/lessons/${lesson.id}/status`, T1, { targetStatus: st });
    const early = await api("POST", `/api/lessons/${lesson.id}/status`, T1, { targetStatus: "PUBLISHED" });
    assert(early.status === 400 && /template text/i.test(early.json.error ?? "") && /Concept Explanation/.test(early.json.error), `Refused, naming the section: "${early.json.error}"`);
    await save({ contentBlocks: [mkBlock("TEXT", "Concept Explanation", "Real explanation"), cp("(replace this text)")] });
    assert((await api("POST", `/api/lessons/${lesson.id}/status`, T1, { targetStatus: "PUBLISHED" })).status === 400, "Template text inside a question's structured data is found too");
    await save({ contentBlocks: [mkBlock("TEXT", "Concept Explanation", "Real explanation"), cp("Pick A")] });
    assert((await api("POST", `/api/lessons/${lesson.id}/status`, T1, { targetStatus: "PUBLISHED" })).status === 200, "Once the text is real the lesson publishes");
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* */ } }
  }
  console.log(`\nPHASE 41 LESSON-SAVE RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

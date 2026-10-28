/**
 * Tuklas AI - Phase 41: teachers add the curriculum structure for Terms 2 and 3 (units, competencies, skills, prerequisites). Black-box over HTTP.
 *   PostgreSQL:  DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase41-structure.ts   (full suite)
 *   in-memory:   AI_PROVIDER=local npx tsx scripts/test-phase41-structure.ts   (checks the demo mode refuses cleanly)
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p41.${t}.${run}@example.edu`;
let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);

async function main() {
  const port = 6500 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
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
    const S = (await api("POST", "/api/auth/register", undefined, { name: "Stu", email: email("s"), password: PASSWORD })).json.token as string;

    if (!DB_MODE) {
      section("Demo (in-memory) mode refuses cleanly");
      const r = await api("POST", "/api/units", T1, { termNumber: 3, title: `P41 unit ${run}` });
      assert(r.status === 409 && /database/i.test(r.json.error ?? ""), `Creating a unit says it needs the database (${r.status}: ${r.json.error})`);
      assert((await api("POST", "/api/units", S, { termNumber: 3, title: "x y z" })).status === 403, "A student is refused (403) before anything else");
      assert((await api("POST", "/api/units", undefined, { termNumber: 3, title: "x y z" })).status === 401, "Signed out: 401");
      assert((await api("DELETE", "/api/skills/anything", T1)).status === 409, "Deleting says it needs the database (409)");
      const skills = (await api("GET", "/api/skills", T1)).json.data as any[];
      assert((await api("POST", `/api/skills/${skills[1].id}/prerequisites`, T1, { prerequisiteSkillIds: [skills[0].id] })).status === 200, "The demo store's prerequisites still work");
    } else {

    const tree = async () => (await api("GET", "/api/curriculum", T1)).json.data[0].grades[0].terms as any[];
    const findUnit = async (id: string) => (await tree()).flatMap((t: any) => t.units.map((u: any) => ({ ...u, termNumber: t.termNumber }))).find((u: any) => u.id === id);
    const U = (b: any, tok = T1) => api("POST", "/api/units", tok, b);

    section("1. A unit in Term 3 (which did not exist)");
    if ((await tree()).some((t: any) => t.termNumber === 3)) console.log("  (note: Term 3 already exists in this database; the wrapper uses a fresh one)");
    const u1 = await U({ termNumber: 3, title: `P41 Rational Numbers ${run}`, description: "Fractions, decimals and their operations" });
    assert(u1.status === 201 && u1.json.data.createdById !== undefined, `Unit created (${u1.status})`);
    const t3 = (await tree()).find((t: any) => t.termNumber === 3);
    assert(!!t3 && t3.name === "Term 3" && t3.units.some((u: any) => u.id === u1.json.data.id), "Term 3 now exists with the unit");
    assert((await tree()).map((t: any) => t.termNumber).join() === "1,2,3", "Terms are listed in order 1, 2, 3");
    const u2 = await U({ termNumber: 3, title: `P41 Roots ${run}` });
    assert(u2.json.data.sequenceOrder === u1.json.data.sequenceOrder + 1, "The next unit in the term gets the next place");
    assert((await U({ termNumber: 3, title: `p41 rational numbers ${run}` })).status === 409, "The same title in the same term (any capitals): 409");
    assert((await U({ termNumber: 2, title: `P41 Rational Numbers ${run}` })).status === 201, "...but the same title in another term is fine");
    for (const bad of [{ termNumber: 0 }, { termNumber: 4 }, { termNumber: "x" }, { termNumber: 1.5 }, { termNumber: 3, title: "ab" }, { termNumber: 3, title: 12345 }, { termNumber: 3, title: "x".repeat(121) }, { termNumber: 3, title: "Valid title", description: "d".repeat(501) }, {}]) {
      assert((await U({ title: "Valid unit title", ...bad })).status === 400, `Refused: ${JSON.stringify(bad).slice(0, 60)}`);
    }
    assert((await U({ termNumber: 3, title: "Student unit" }, S)).status === 403 && (await api("POST", "/api/units", undefined, { termNumber: 3, title: "Anon unit" })).status === 401, "Student 403, signed out 401");

    section("2. Competencies");
    const cp = (unitId: string, b: any, tok = T1) => api("POST", `/api/units/${unitId}/competencies`, tok, b);
    const c1 = await cp(u1.json.data.id, { code: "G7-T3-C1", statement: "Performs operations on rational numbers." });
    assert(c1.status === 201 && c1.json.data.code === "G7-T3-C1", "Competency created with a code");
    const c2 = await cp(u1.json.data.id, { statement: "Solves problems involving rational numbers." });
    assert(c2.status === 201 && /^C\d+$/.test(c2.json.data.code), `No code: one is made (${c2.json.data.code})`);
    assert((await cp(u1.json.data.id, { code: "g7-t3-c1", statement: "Another competency statement" })).status === 409, "A repeated code in the unit: 409");
    assert((await cp(u1.json.data.id, { statement: "abc" })).status === 400 && (await cp(u1.json.data.id, {})).status === 400, "Too short or missing statement: 400");
    assert((await cp("no-such-unit", { statement: "A valid statement" })).status === 404, "Unknown unit: 404");

    section("3. Skills (and prerequisites to skills of another term)");
    const sk = (compId: string, b: any, tok = T1) => api("POST", `/api/competencies/${compId}/skills`, tok, b);
    const real = (await api("GET", "/api/skills", T1)).json.data as any[];
    const term1Skill = real.find((s) => s.title === "Solve percentage increase problems") ?? real[0];
    const s1 = await sk(c1.json.data.id, { title: `P41 Add rational numbers ${run}`, description: "Add fractions and decimals", difficulty: 2.5 });
    assert(s1.status === 201 && s1.json.data.difficulty === 2.5, "Skill created");
    const s2 = await sk(c1.json.data.id, { title: `P41 Multiply rational numbers ${run}`, prerequisiteSkillIds: [s1.json.data.id, term1Skill.id] });
    assert(s2.status === 201 && s2.json.data.difficulty === 2, "A skill with prerequisites (one from Term 1) is created; difficulty defaults to 2");
    const afterSkills = (await api("GET", "/api/skills", T1)).json.data as any[];
    const s2row = afterSkills.find((s) => s.id === s2.json.data.id);
    assert(s2row.prerequisites.length === 2 && /Rational/.test(s2row.competency?.unit?.title ?? "") && s2row.competency.unit.term.termNumber === 3, "/api/skills lists the prerequisites and says which unit and term the skill is in");
    const before = (await api("GET", "/api/skills", T1)).json.data.length;
    const bad = await sk(c1.json.data.id, { title: `P41 Broken ${run}`, prerequisiteSkillIds: ["no-such-skill"] });
    assert(bad.status === 404 && (await api("GET", "/api/skills", T1)).json.data.length === before, "An unknown prerequisite refuses the whole request and leaves no half-made skill");
    assert((await sk(c1.json.data.id, { title: `p41 add rational numbers ${run}` })).status === 409, "A repeated title in the competency: 409");
    for (const b of [{ title: "ab" }, { title: "Good title", difficulty: 0 }, { title: "Good title", difficulty: 6 }, { title: "Good title", difficulty: "hard" }, { title: "Good title", description: "d".repeat(501) }, {}]) assert((await sk(c1.json.data.id, b)).status === 400, `Refused: ${JSON.stringify(b).slice(0, 50)}`);
    assert((await sk("no-such", { title: "Good title" })).status === 404, "Unknown competency: 404");

    section("4. Editing prerequisites on real skills (this returned 'Target skill does not exist' for every database skill)");
    const pre = (id: string, ids: unknown, tok = T1) => api("POST", `/api/skills/${id}/prerequisites`, tok, { prerequisiteSkillIds: ids });
    const sA = s1.json.data.id as string, sB = s2.json.data.id as string;
    const s3 = (await sk(c2.json.data.id, { title: `P41 Solve rational problems ${run}` })).json.data.id as string;
    assert((await pre(s3, [sB])).status === 200, "Set a prerequisite");
    assert((await pre(sA, [sA])).status === 400, "A skill cannot require itself");
    assert((await pre(sA, [sB])).status === 400, "A direct circle (A needs B, B needs A) is refused");
    assert((await pre(sA, [s3])).status === 400, "An indirect circle (A needs C, C needs B, B needs A) is refused");
    assert((await pre(sA, ["no-such-skill"])).status === 404 && (await pre("no-such-skill", [sA])).status === 404, "Unknown skill ids: 404");
    assert((await pre(sA, "x")).status === 400 && (await pre(sA, [1, 2])).status === 400, "Not a list of ids: 400");
    assert((await pre(s3, [sB, sB])).status === 200, "A repeated id is ignored");
    assert((await api("GET", "/api/skills", T1)).json.data.find((s: any) => s.id === s3).prerequisites.length === 1, "...and stored once");
    assert((await pre(s3, [])).status === 200 && (await api("GET", "/api/skills", T1)).json.data.find((s: any) => s.id === s3).prerequisites.length === 0, "An empty list clears them");
    assert((await pre(sA, [term1Skill.id], T2)).status === 403, "Another teacher cannot change the prerequisites of a skill that teacher did not add");
    assert((await pre(term1Skill.id, [], S)).status === 403, "A student: 403");
    // a platform skill (no creator) can be edited by any teacher; put it back afterwards
    const seedSkill = real.find((s) => s.title === "Rates and unit rates") ?? real.find((s) => s.id !== term1Skill.id && !s.createdById);
    const seedPrereq = (seedSkill.prerequisites ?? []).map((p: any) => p.prerequisiteSkillId);
    assert((await pre(seedSkill.id, seedPrereq, T2)).status === 200, "A platform skill (no creator) can be edited by any teacher");

    section("5. Who may edit what");
    assert((await api("PUT", `/api/units/${u1.json.data.id}`, T2, { title: "Hijacked" })).status === 403, "Another teacher cannot rename my unit");
    assert((await api("PUT", `/api/competencies/${c1.json.data.id}`, T2, { statement: "Hijacked statement" })).status === 403, "...or my competency");
    assert((await api("PUT", `/api/skills/${sA}`, T2, { title: "Hijacked" })).status === 403, "...or my skill");
    assert((await api("DELETE", `/api/skills/${sA}`, T2)).status === 403 && (await api("DELETE", `/api/units/${u2.json.data.id}`, T2)).status === 403, "...or delete them");
    assert((await api("PUT", `/api/units/${u1.json.data.id}`, T1, { title: `P41 Rational Numbers and Decimals ${run}` })).status === 200 && (await findUnit(u1.json.data.id)).title.includes("and Decimals"), "I can rename my own unit");
    assert((await api("PUT", `/api/skills/${sA}`, admin, { difficulty: 3 })).status === 200, "An administrator can edit anything");
    assert((await api("PUT", `/api/units/${u1.json.data.id}`, T1, {})).status === 400 && (await api("PUT", `/api/units/${u1.json.data.id}`, T1, { title: "ab" })).status === 400, "Empty or too-short edits: 400");
    assert((await api("PUT", `/api/units/${u1.json.data.id}`, T1, { title: `P41 Roots ${run}` })).status === 409, "Renaming to a title already used in the term: 409");
    assert((await api("PUT", "/api/units/no-such", T1, { title: "Valid title" })).status === 404, "Unknown unit: 404");

    section("6. Deleting only what is empty");
    const lesson = (await api("POST", "/api/lessons", T1, { title: `P41 Lesson ${run}`, unitId: u1.json.data.id, learningObjectives: ["x"], skillIds: [sA] })).json.data;
    for (const st of ["REVIEW", "APPROVED", "PUBLISHED"]) await api("POST", `/api/lessons/${lesson.id}/status`, T1, { targetStatus: st });
    const d1 = await api("DELETE", `/api/skills/${sA}`, T1);
    assert(d1.status === 409 && /lesson/i.test(d1.json.error) && /require it/i.test(d1.json.error), `A skill used by a lesson (and required by another skill) says what is in the way: "${d1.json.error}"`);
    const q = (await api("POST", "/api/questions", T1, { type: "NUMERIC_INPUT", prompt: `P41 q ${run}`, status: "DRAFT", skillId: s3, questionData: { correctAnswer: 1 } })).json.data;
    assert((await api("DELETE", `/api/skills/${s3}`, T1)).status === 409, "A skill that a question refers to cannot be deleted");
    await api("DELETE", `/api/questions/${q.id}`, T1);
    assert((await api("DELETE", `/api/skills/${s3}`, T1)).status === 200, "...but once nothing refers to it, it can");
    assert((await api("DELETE", `/api/competencies/${c1.json.data.id}`, T1)).status === 409, "A competency with skills cannot be deleted");
    assert((await api("DELETE", `/api/units/${u1.json.data.id}`, T1)).status === 409, "A unit with lessons or competencies cannot be deleted");
    assert((await api("DELETE", `/api/competencies/${c2.json.data.id}`, T1)).status === 200, "An empty competency can");
    assert((await api("DELETE", `/api/units/${u2.json.data.id}`, T1)).status === 200 && !(await findUnit(u2.json.data.id)), "An empty unit can");
    assert((await api("DELETE", "/api/units/no-such", T1)).status === 404 && (await api("DELETE", "/api/skills/no-such", T1)).status === 404 && (await api("DELETE", "/api/competencies/no-such", T1)).status === 404, "Unknown ids: 404");

    section("6b. Reordering the units of a term");
    const order = async (n: number) => (await tree()).find((x: any) => x.termNumber === n).units.map((u: any) => u.id) as string[];
    const rU = (n: unknown, ids: unknown, tok = T1) => api("POST", `/api/terms/${n}/reorder-units`, tok, { orderedUnitIds: ids });
    const u3 = (await U({ termNumber: 3, title: `P41 Third unit ${run}` })).json.data.id as string;
    const before3 = await order(3);
    assert(before3.length >= 2 && before3[before3.length - 1] === u3, "(setup) the newest unit is last in Term 3");
    const swapped = [u3, ...before3.filter((x) => x !== u3)];
    assert((await rU(3, swapped)).status === 200 && (await order(3)).join() === swapped.join(), "Units are put in the new order");
    assert((await rU(3, before3.slice(1))).status === 400 && (await rU(3, [...before3, before3[0]])).status === 400 && (await rU(3, [...before3.slice(1), "nope"])).status === 400, "A list that misses a unit, repeats one or names a stranger: 400");
    assert((await rU(3, "x")).status === 400 && (await rU(9, [])).status === 400 && (await rU("x", [])).status === 400, "Not a list / not a term: 400");
    assert((await rU(3, before3, S)).status === 403 && (await api("POST", "/api/terms/3/reorder-units", undefined, { orderedUnitIds: before3 })).status === 401, "A student 403, signed out 401");
    assert((await order(3)).join() === swapped.join(), "Refused requests changed nothing");
    await rU(3, before3);

    section("7. The new lesson reaches students in course order");
    const path = (await api("GET", "/api/student/learning-path", S)).json.data.learningPath as any[];
    const idx = path.findIndex((n) => n.lessonId === lesson.id);
    assert(idx === path.length - 1 && idx > 0, `The Term 3 lesson comes after every earlier lesson (position ${idx + 1} of ${path.length})`);
    assert(path[idx].state === "LOCKED" && /Requires completion/.test(path[idx].lockReasons.join(" ")), "...and is locked behind the lesson before it (a teacher can open it for a class)");
    assert(path[idx].skills.some((s: any) => s.id === sA), "The lesson carries the skill the teacher created");
    }
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* */ } }
  }
  console.log(`\nPHASE 41 RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

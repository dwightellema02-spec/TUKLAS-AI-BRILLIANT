/**
 * Tuklas AI - Phase 27: server-side grading of checkpoint / question blocks and answer-key secrecy.
 *   in-memory:   AI_PROVIDER=local npx tsx scripts/test-phase27-grading.ts
 *   PostgreSQL:  DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase27-grading.ts
 * Part 1 is a pure unit test of the grading module; part 2 is black-box over HTTP against a spawned server.
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { parseChoiceBlock, gradeChoiceAnswer, toStudentBlockView, normalizeAnswer } from "../src/lib/lesson/block-grading";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p27.${t}.${run}@example.edu`;

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => {
  if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); }
};
const section = (t: string) => console.log(`\n--- ${t} ---`);
const meta = (o: object) => JSON.stringify(o);

function unitTests() {
  section("1. Grading module (pure)");
  const good = { id: "b", type: "CHECKPOINT", metadata: meta({ question: "q", options: ["-5", "-2", "-8"], correctAnswer: "-2", explanation: "because" }) };
  assert(parseChoiceBlock(good)?.correctAnswer === "-2", "A well-formed block parses");
  const bad = (m: unknown, type = "CHECKPOINT") => parseChoiceBlock({ id: "b", type, metadata: m as any });
  assert(bad(undefined) === null && bad(null) === null && bad("") === null, "No metadata -> cannot be graded");
  assert(bad("{not json") === null && bad("[]") === null && bad("42") === null, "Malformed metadata JSON -> cannot be graded");
  assert(bad(meta({ options: ["a"], correctAnswer: "a" })) === null, "A single option -> cannot be graded");
  assert(bad(meta({ options: ["a", "b"] })) === null, "No correctAnswer -> cannot be graded");
  assert(bad(meta({ options: ["a", "b"], correctAnswer: "c" })) === null, "correctAnswer not among the options -> cannot be graded");
  assert(bad(meta({ options: ["a", "A"], correctAnswer: "a" })) === null, "Options that differ only by case are ambiguous -> cannot be graded");
  assert(bad(meta({ options: ["a", 2], correctAnswer: "a" })) === null, "A non-string option -> cannot be graded");
  assert(bad(meta({ options: ["a", "b"], correctAnswer: "a" }), "TEXT") === null, "A TEXT block is never gradable");
  const g = (a: unknown) => gradeChoiceAnswer(good, a) as any;
  assert(g("-2").isCorrect === true && g("-2").correctAnswer === "-2", "Correct answer -> correct, and the key is returned");
  assert(g(" -2 ").isCorrect === true, "Surrounding spaces are tolerated");
  assert(g("-5").ok && g("-5").isCorrect === false && g("-5").correctAnswer === undefined, "Wrong answer -> incorrect, and the key is NOT returned");
  assert(g("-5").feedback === "because", "The explanation is returned after answering");
  assert(g("7").ok === false && g("7").status === 400, "An answer that is not a choice -> 400");
  assert(g("").ok === false && g(undefined).ok === false && g(42).ok === false && g({}).ok === false, "Empty / non-string answers -> 400");
  assert(g("x".repeat(500)).ok === false, "Over-long answers -> 400");
  assert((gradeChoiceAnswer({ id: "b", type: "CHECKPOINT", metadata: "{}" }, "a") as any).status === 422, "An unconfigured block -> 422");
  assert(normalizeAnswer("  A   b ") === "a b", "Normalisation trims, collapses spaces, ignores case");
  const view = toStudentBlockView({ ...good, metadata: meta({ question: "q", options: ["a", "b"], correctAnswer: "a", explanation: "e", hint: "h" }) });
  const vm = JSON.parse(view.metadata!);
  assert(!("correctAnswer" in vm) && !("explanation" in vm) && vm.hint === "h" && vm.options.length === 2 && vm.question === "q", "Student view drops the key and explanation but keeps question, options and hint");
  assert(toStudentBlockView({ id: "t", type: "TEXT", metadata: "keep" }).metadata === "keep", "Non-question blocks are untouched");
  assert(toStudentBlockView({ id: "t", type: "QUESTION", metadata: "{broken" }).metadata === undefined, "Unparseable question metadata is dropped rather than leaked");
}

async function main() {
  unitTests();

  const port = 3600 + Math.floor(Math.random() * 90);
  const base = `http://127.0.0.1:${port}`;
  const secret = crypto.randomBytes(32).toString("hex");
  let server: ChildProcess | undefined;
  const start = async () => {
    server = spawn("npx", ["tsx", "server.ts"], {
      env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: secret },
      stdio: ["ignore", "ignore", "ignore"], detached: true,
    });
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* waiting */ }
    }
    throw new Error("server did not start");
  };
  const stop = async () => { try { if (server?.pid) process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ } await new Promise((r) => setTimeout(r, 1500)); };
  const api = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = {};
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  };
  // A student can legitimately find the answers by trying the choices: answer every question until it is correct.
  const answerAllQuestions = async (tok: string, lessonId: string) => {
    const view = (await api("GET", `/api/lessons/${lessonId}`, tok)).json.data;
    for (const b of view?.contentBlocks ?? []) {
      if (b.type !== "CHECKPOINT" && b.type !== "QUESTION") continue;
      let opts: string[] = [];
      try { opts = JSON.parse(b.metadata ?? "{}").options ?? []; } catch { /* none */ }
      for (const o of opts) {
        const r = await api("POST", `/api/student/lessons/${lessonId}/checkpoint`, tok, { blockId: b.id, answer: o });
        if (r.json?.grading?.isCorrect || r.status === 422) break;
      }
    }
  };
  const login = async (e: string, p: string) => (await api("POST", "/api/auth/login", undefined, { email: e, password: p })).json.token as string;

  try {
    await start();
    console.log(`\nServer up (${DB_MODE ? "PostgreSQL" : "in-memory"} mode)`);

    section("2. Setup: a teacher authors a lesson with real question blocks");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await api("POST", "/api/admin/users", admin, { name: "Teacher P27", email: email("t"), password: PASSWORD, role: "TEACHER" });
    const T = await login(email("t"), PASSWORD);
    const reg = async (tag: string) => {
      const r = await api("POST", "/api/auth/register", undefined, { name: `Student ${tag}`, email: email(tag), password: PASSWORD });
      return { token: r.json.token as string, id: r.json.user.id as string };
    };
    const s1 = await reg("s1"), s2 = await reg("s2");

    const KEY = `KEY-${run}-ZED`;          // the correct answer: must never reach a student before they find it
    const EXPL = `EXPL-${run}-WHY`;        // the explanation: only returned after answering
    const KEY2 = `KEY2-${run}-ALPHA`;
    const unit = (await api("GET", "/api/curriculum", T)).json.data?.[0]?.grades?.[0]?.terms?.[0]?.units?.[0];
    const lesson = (await api("POST", "/api/lessons", T, { title: `P27 Lesson ${run}`, unitId: unit.id, learningObjectives: ["x"] })).json.data.id as string;
    const addBlock = (type: string, title: string, content: string, metadata?: string) =>
      api("POST", `/api/lessons/${lesson}/blocks`, T, { type, title, content, metadata });
    const cp = (await addBlock("CHECKPOINT", "Checkpoint", "Pick one", meta({ question: "Pick one", options: ["Wrong A", KEY, "Wrong C"], correctAnswer: KEY, explanation: EXPL }))).json.data.id as string;
    const qs = (await addBlock("QUESTION", "Question", "Pick again", meta({ question: "Pick again", options: ["No", KEY2], correctAnswer: KEY2, explanation: `${EXPL}-2`, hint: "A hint" }))).json.data.id as string;
    const tx = (await addBlock("TEXT", "Intro", "Just text")).json.data.id as string;

    const broken = await api("POST", "/api/lessons", T, { title: `P27 Broken ${run}`, unitId: unit.id, learningObjectives: ["x"] });
    const brokenId = broken.json.data.id as string;
    const bk = (await api("POST", `/api/lessons/${brokenId}/blocks`, T, { type: "CHECKPOINT", title: "Broken checkpoint", content: "Q", metadata: meta({ options: ["only one"], correctAnswer: "nope" }) })).json.data.id as string;
    for (const st of ["REVIEW", "APPROVED"]) await api("POST", `/api/lessons/${brokenId}/status`, T, { targetStatus: st });
    const pubBroken = await api("POST", `/api/lessons/${brokenId}/status`, T, { targetStatus: "PUBLISHED" });
    assert(pubBroken.status === 400 && /Broken checkpoint/.test(pubBroken.json.error), "A lesson with an ungradable checkpoint cannot be published (and the message names it)");
    await api("PUT", `/api/lessons/${brokenId}/blocks/${bk}`, T, { metadata: meta({ options: ["one", "two"], correctAnswer: "two" }) });
    const pubFixed = await api("POST", `/api/lessons/${brokenId}/status`, T, { targetStatus: "PUBLISHED" });
    assert(pubFixed.status === 200, "...and can be published once it is fixed");

    for (const st of ["REVIEW", "APPROVED", "PUBLISHED"]) await api("POST", `/api/lessons/${lesson}/status`, T, { targetStatus: st });

    // Unlock the lesson for s1 through the real routes
    const path = async (tok: string) => (await api("GET", "/api/student/learning-path", tok)).json.data;
    let guard = 0;
    while ((await path(s1.token)).learningPath.find((n: any) => n.lessonId === lesson)?.state === "LOCKED" && guard++ < 40) {
      const cur = (await path(s1.token)).learningPath.find((n: any) => n.state !== "COMPLETED");
      await answerAllQuestions(s1.token, cur.lessonId);
      if ((await api("POST", "/api/student/progress", s1.token, { lessonId: cur.lessonId, action: "COMPLETE" })).status !== 200) break;
    }
    assert((await path(s1.token)).learningPath.find((n: any) => n.lessonId === lesson)?.state !== "LOCKED", "The lesson is unlocked for student 1");

    section("3. The answer key never reaches a student");
    const stuLesson = await api("GET", `/api/lessons/${lesson}`, s1.token);
    assert(stuLesson.status === 200 && !/correctAnswer/.test(stuLesson.text) && !stuLesson.text.includes(EXPL), "GET /api/lessons/:id as a student: no correct answer, no explanation");
    const stuBlock = stuLesson.json.data.contentBlocks.find((b: any) => b.id === cp);
    const sm = JSON.parse(stuBlock.metadata);
    assert(sm.options.length === 3 && sm.options.includes(KEY) && !("correctAnswer" in sm), "...but the question and its choices are there (the right choice is just one of three, unmarked)");
    assert(JSON.parse(stuLesson.json.data.contentBlocks.find((b: any) => b.id === qs).metadata).hint === "A hint", "...and hints still work");
    const list = await api("GET", "/api/lessons", s1.token);
    assert(!list.text.includes(EXPL) && !/correctAnswer/.test(list.text), "GET /api/lessons as a student: no answer keys");
    const cur = await api("GET", "/api/curriculum", s1.token);
    assert(!cur.text.includes(EXPL) && !/correctAnswer/.test(cur.text), "GET /api/curriculum as a student: no answer keys anywhere");
    const anon = await api("GET", "/api/curriculum");
    assert(anon.status === 200 && !/correctAnswer/.test(anon.text) && !anon.text.includes(EXPL), "GET /api/curriculum signed out: no answer keys");
    const draftTitle = `P27 Draft ${run}`;
    await api("POST", "/api/lessons", T, { title: draftTitle, unitId: unit.id, learningObjectives: ["x"] });
    assert(!(await api("GET", "/api/curriculum")).text.includes(draftTitle) && (await api("GET", "/api/curriculum", T)).text.includes(draftTitle), "...and a signed-out visitor sees no DRAFT lessons (a teacher does)");
    const teacherView = await api("GET", `/api/lessons/${lesson}`, T);
    assert(teacherView.text.includes(EXPL) && teacherView.text.includes(`"correctAnswer`), "The teacher still sees the full block, key included");

    section("4. The server decides correctness");
    const post = (tok: string | undefined, body: unknown, lessonId = lesson) => api("POST", `/api/student/lessons/${lessonId}/checkpoint`, tok, body);
    const wrongLie = await post(s1.token, { blockId: cp, answer: "Wrong A", isCorrect: true, feedback: "I am right" });
    assert(wrongLie.status === 200 && wrongLie.json.grading.isCorrect === false, "A wrong answer is graded wrong even if the client claims isCorrect:true");
    assert(wrongLie.json.data.isCorrect === false && wrongLie.json.data.feedback !== "I am right", "...and the stored attempt is wrong, with the server's feedback (client feedback ignored)");
    assert(!wrongLie.text.includes(KEY) || wrongLie.text.split(KEY).length === 1, "...and the response does not reveal the correct answer");
    assert(wrongLie.json.grading.feedback === EXPL, "...but does give the explanation");
    const rightDeny = await post(s1.token, { blockId: cp, answer: KEY, isCorrect: false });
    assert(rightDeny.json.grading.isCorrect === true && rightDeny.json.grading.correctAnswer === KEY && rightDeny.json.data.isCorrect === true, "A correct answer is graded correct even if the client claims isCorrect:false; the key is shown to a student who found it");
    assert(rightDeny.json.data.attempt === 2, "Attempts are numbered by the server (2nd attempt)");
    const spaced = await post(s1.token, { blockId: qs, answer: `  ${KEY2.toLowerCase()}  ` });
    assert(spaced.json.grading?.isCorrect === true && spaced.json.data.answer === KEY2, "Case/space variants of a choice are accepted and stored as the canonical choice");
    assert((await post(s1.token, { blockId: cp, answer: "Something else" })).status === 400, "An answer that is not a choice -> 400");
    assert((await post(s1.token, { blockId: cp, answer: "" })).status === 400, "Empty answer -> 400");
    assert((await post(s1.token, { blockId: cp, answer: "x".repeat(1000) })).status === 400, "Huge answer -> 400");
    assert((await post(s1.token, { blockId: cp })).status === 400 && (await post(s1.token, { answer: "a" })).status === 400, "Missing blockId or answer -> 400");
    assert((await post(s1.token, { blockId: tx, answer: "x" })).status === 400, "A TEXT block cannot be 'answered' (400)");
    assert((await post(s1.token, { blockId: "nope", answer: "x" })).status === 404, "Unknown block -> 404");
    assert((await post(s1.token, { blockId: bk, answer: "one" })).status === 404, "A block from another lesson -> 404");
    assert((await post(undefined, { blockId: cp, answer: KEY })).status === 401, "Signed out -> 401");
    const session = await api("GET", `/api/student/lessons/${lesson}/session`, s1.token);
    const attempts = session.json.data.attempts.filter((a: any) => a.blockId === cp).sort((a: any, b: any) => a.attempt - b.attempt);
    assert(attempts.length === 2 && attempts[0].isCorrect === false && attempts[1].isCorrect === true, "History shows the server's grading for each attempt");
    assert(session.json.data.session.completedBlockIds.includes(cp), "A block becomes 'completed' after a correct answer");

    // A student whose only attempt was wrong has not completed the block
    const s1b = await reg("s1b");
    const lockedTry = await post(s1b.token, { blockId: cp, answer: KEY });
    assert([403, 404].includes(lockedTry.status), "A student whose path has not unlocked the lesson cannot answer its questions");
    assert((await post(s2.token, { blockId: cp, answer: KEY })).status === 403, "Student 2 (lesson locked) -> 403");

    section("5. Unconfigured questions fail safe for students");
    // Break a published block after publication (a teacher edit): the student gets a clear 422, never a free pass.
    await api("PUT", `/api/lessons/${lesson}/blocks/${qs}`, T, { metadata: meta({ question: "Pick again", options: ["No", KEY2] }) });
    const unconf = await post(s1.token, { blockId: qs, answer: KEY2 });
    assert(unconf.status === 422 && !unconf.text.includes(KEY2 + "\"") , "A published question with no usable key -> 422, not graded correct");

    if (DB_MODE && process.env.RESTART_CHECK) {
      section("6. Persistence (PostgreSQL)");
      await stop(); await start();
      const s1c = await login(email("s1"), PASSWORD);
      const again = await api("GET", `/api/student/lessons/${lesson}/session`, s1c);
      assert(again.json.data.attempts.filter((a: any) => a.blockId === cp).length === 2, "Graded attempts survive a server restart");
    }
  } finally {
    await stop();
  }

  console.log(`\n======================================================\nPHASE 27 RESULTS (${DB_MODE ? "PostgreSQL" : "in-memory"}): ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("ALL PHASE 27 CHECKS PASSED (see docs/PHASE_27_VERIFICATION.md for what is NOT covered).");
  process.exit(0);
}
main().catch((e) => { console.error("Phase 27 suite crashed:", e); process.exit(1); });

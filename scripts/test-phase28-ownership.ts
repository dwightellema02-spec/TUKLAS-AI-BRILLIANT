/**
 * Tuklas AI - Phase 28: ownership of lessons/questions/practice sets and server-enforced lesson completion.
 *   in-memory:   AI_PROVIDER=local npx tsx scripts/test-phase28-ownership.ts
 *   PostgreSQL:  DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase28-ownership.ts
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p28.${t}.${run}@example.edu`;

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => {
  if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); }
};
const section = (t: string) => console.log(`\n--- ${t} ---`);
const meta = (o: object) => JSON.stringify(o);

async function main() {
  const port = 3700 + Math.floor(Math.random() * 90);
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

    section("1. Setup: two teachers, an admin, a student");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await api("POST", "/api/admin/users", admin, { name: "Teacher One", email: email("t1"), password: PASSWORD, role: "TEACHER" });
    await api("POST", "/api/admin/users", admin, { name: "Teacher Two", email: email("t2"), password: PASSWORD, role: "TEACHER" });
    const T1 = await login(email("t1"), PASSWORD), T2 = await login(email("t2"), PASSWORD);
    const reg = async (tag: string) => {
      const r = await api("POST", "/api/auth/register", undefined, { name: `Student ${tag}`, email: email(tag), password: PASSWORD });
      return { token: r.json.token as string, id: r.json.user.id as string };
    };
    const s1 = await reg("s1");
    const unit = (await api("GET", "/api/curriculum", T1)).json.data?.[0]?.grades?.[0]?.terms?.[0]?.units?.[0];
    const mkLesson = async (tok: string, title: string) => (await api("POST", "/api/lessons", tok, { title, unitId: unit.id, learningObjectives: ["x"] })).json.data.id as string;
    const addBlock = (tok: string, lessonId: string, type: string, title: string, content: string, metadata?: string) =>
      api("POST", `/api/lessons/${lessonId}/blocks`, tok, { type, title, content, metadata });
    const publish = async (tok: string, lessonId: string) => { for (const st of ["REVIEW", "APPROVED", "PUBLISHED"]) await api("POST", `/api/lessons/${lessonId}/status`, tok, { targetStatus: st }); };

    const L = await mkLesson(T1, `P28 Lesson ${run}`);
    const tx = (await addBlock(T1, L, "TEXT", "Intro", "Read this")).json.data.id as string;
    const q1 = (await addBlock(T1, L, "CHECKPOINT", "Checkpoint one", "Q1", meta({ options: ["a1", "b1"], correctAnswer: "b1", explanation: "e1" }))).json.data.id as string;
    const q2 = (await addBlock(T1, L, "QUESTION", "Question two", "Q2", meta({ options: ["a2", "b2", "c2"], correctAnswer: "c2", explanation: "e2" }))).json.data.id as string;
    await publish(T1, L);
    const question = (await api("POST", "/api/questions", T1, { type: "MULTIPLE_CHOICE", prompt: `P28 question ${run}`, questionData: { choices: [{ id: "a", text: "x" }, { id: "b", text: "y" }], correctAnswer: "a" } })).json.data;
    const practiceSet = (await api("POST", "/api/practice-sets", T1, { title: `P28 set ${run}` })).json.data;
    assert(!!L && !!tx && !!q1 && !!q2 && !!question?.id && !!practiceSet?.id, "Teacher One authored a lesson (3 blocks), a question and a practice set");

    section("2. Another teacher cannot change them");
    const snap = async () => {
      const l = (await api("GET", `/api/lessons/${L}`, T1)).json.data;
      return JSON.stringify([l.contentBlocks.map((b: any) => [b.id, b.type, b.title, b.content, b.metadata, b.sequenceOrder]), (await api("GET", `/api/questions/${question.id}`, T1)).json.data?.prompt, (await api("GET", `/api/practice-sets/${practiceSet.id}`, T1)).json.data?.questions?.length]);
    };
    const before = await snap();
    const forbidden = async (label: string, p: Promise<{ status: number }>) => assert((await p).status === 403, `Teacher Two: ${label} -> 403`);
    await forbidden("add a block to the lesson", api("POST", `/api/lessons/${L}/blocks`, T2, { type: "TEXT", title: "Evil", content: "x" }));
    await forbidden("edit a question's answer key", api("PUT", `/api/lessons/${L}/blocks/${q1}`, T2, { metadata: meta({ options: ["a1", "b1"], correctAnswer: "a1" }) }));
    await forbidden("delete a block", api("DELETE", `/api/lessons/${L}/blocks/${tx}`, T2));
    await forbidden("reorder blocks", api("POST", `/api/lessons/${L}/reorder-blocks`, T2, { orderedBlockIds: [q2, q1, tx] }));
    await forbidden("attach a video", api("POST", `/api/lessons/${L}/video`, T2, { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }));
    await forbidden("PATCH the question", api("PATCH", `/api/questions/${question.id}`, T2, { prompt: "hijacked" }));
    await forbidden("PUT the question", api("PUT", `/api/questions/${question.id}`, T2, { prompt: "hijacked" }));
    await forbidden("change the question's status", api("POST", `/api/questions/${question.id}/status`, T2, { status: "PUBLISHED" }));
    await forbidden("delete the question", api("DELETE", `/api/questions/${question.id}`, T2));
    await forbidden("add a question to the practice set", api("POST", `/api/practice-sets/${practiceSet.id}/questions`, T2, { questionId: question.id }));
    await forbidden("remove a question from the practice set", api("DELETE", `/api/practice-sets/${practiceSet.id}/questions/${question.id}`, T2));
    await forbidden("attach a new question to the lesson", api("POST", "/api/questions", T2, { type: "MULTIPLE_CHOICE", prompt: "x", lessonId: L, questionData: {} }));
    await forbidden("attach a new practice set to the lesson", api("POST", "/api/practice-sets", T2, { title: "x", lessonId: L }));
    await forbidden("reorder a unit that contains Teacher One's lessons", api("POST", `/api/units/${unit.id}/reorder-lessons`, T2, { orderedLessonIds: [L] }));
    const orderBefore = JSON.stringify(((await api("GET", `/api/lessons?unitId=${unit.id}`, admin)).json.data as any[]).map((l) => [l.id, l.sequenceOrder]).sort());
    assert(await snap() === before, "None of those attempts changed anything");
    assert(JSON.stringify(((await api("GET", `/api/lessons?unitId=${unit.id}`, admin)).json.data as any[]).map((l) => [l.id, l.sequenceOrder]).sort()) === orderBefore, "...including the order of the unit's lessons");
    assert((await api("GET", `/api/questions/${question.id}`, T2)).status === 200, "Teacher Two can still READ the shared question bank");
    assert((await api("POST", `/api/lessons/nope/blocks`, T1, { type: "TEXT", title: "x", content: "x" })).status === 404, "A block on an unknown lesson -> 404 (not 500)");
    assert((await api("POST", `/api/lessons/${L}/blocks`, undefined, { type: "TEXT", title: "x", content: "x" })).status === 403, "Signed out -> 403");

    section("3. The owner and an administrator still can");
    assert((await api("PUT", `/api/lessons/${L}/blocks/${tx}`, T1, { title: "Intro (edited)" })).status === 200, "The owner edits a block");
    assert((await api("POST", `/api/lessons/${L}/reorder-blocks`, T1, { orderedBlockIds: [tx, q1, q2] })).status === 200, "The owner reorders blocks");
    assert((await api("PATCH", `/api/questions/${question.id}`, T1, { prompt: `P28 question ${run} (edited)` })).status === 200, "The owner edits the question");
    assert((await api("POST", `/api/practice-sets/${practiceSet.id}/questions`, T1, { questionId: question.id })).status === 200, "The owner adds a question to the practice set");
    assert((await api("PUT", `/api/lessons/${L}/blocks/${tx}`, admin, { title: "Intro (admin)" })).status === 200, "An administrator can edit another teacher's block");
    assert((await api("PATCH", `/api/questions/${question.id}`, admin, { prompt: `P28 question ${run} (admin)` })).status === 200, "An administrator can edit another teacher's question");
    const currentOrder = ((await api("GET", `/api/lessons?unitId=${unit.id}`, admin)).json.data as any[]).sort((a, b) => a.sequenceOrder - b.sequenceOrder).map((l) => l.id);
    assert((await api("POST", `/api/units/${unit.id}/reorder-lessons`, admin, { orderedLessonIds: currentOrder })).status === 200, "An administrator may reorder a shared unit (same order re-submitted)");

    section("4. Completion requires answering every question correctly");
    const path = async (tok: string) => (await api("GET", "/api/student/learning-path", tok)).json.data;
    const stateOf = async (id: string) => (await path(s1.token)).learningPath.find((n: any) => n.lessonId === id);
    let guard = 0;
    while ((await stateOf(L))?.state === "LOCKED" && guard++ < 40) {
      const cur = (await path(s1.token)).learningPath.find((n: any) => n.state !== "COMPLETED");
      await answerAllQuestions(s1.token, cur.lessonId);
      if ((await api("POST", "/api/student/progress", s1.token, { lessonId: cur.lessonId, action: "COMPLETE" })).status !== 200) break;
    }
    assert((await stateOf(L))?.state === "AVAILABLE", "The lesson is unlocked for the student");

    const complete = () => api("POST", "/api/student/progress", s1.token, { lessonId: L, action: "COMPLETE" });
    const c0 = await complete();
    assert(c0.status === 409 && c0.json.missingBlockIds?.length === 2 && /2 remaining questions/.test(c0.json.error), "COMPLETE with no answers -> 409, naming the 2 missing questions");
    const sc = await api("POST", `/api/student/lessons/${L}/session`, s1.token, { currentSectionIndex: 2, completedBlockIds: [tx, q1, q2], isCompleted: true });
    assert(sc.status === 409 && sc.json.missingBlockIds?.length === 2, "Completing through the session route -> 409 too");
    assert((await stateOf(L)).state !== "COMPLETED", "...and the lesson is not completed");
    await api("POST", "/api/student/progress", s1.token, { lessonId: L, action: "UPDATE_BLOCKS", completedBlockIndex: 2, totalBlocks: 3 });
    const capped = await stateOf(L);
    assert(capped.state === "IN_PROGRESS" && capped.progressPercentage === 99, "Viewing every block does not complete it: progress stops at 99%");

    await api("POST", `/api/student/lessons/${L}/session`, s1.token, { currentSectionIndex: 2, completedBlockIds: [tx, q1, q2], isCompleted: false });
    const sess1 = await api("GET", `/api/student/lessons/${L}/session`, s1.token);
    assert(!sess1.json.data.session.completedBlockIds.includes(q1) && !sess1.json.data.session.completedBlockIds.includes(q2), "A forged completedBlockIds list did not mark the unanswered questions as done");
    assert(sess1.json.data.session.completedBlockIds.includes(tx), "...while the reading block (self-reported) is kept");

    const wrong = await api("POST", `/api/student/lessons/${L}/checkpoint`, s1.token, { blockId: q1, answer: "a1" });
    assert(wrong.json.grading.isCorrect === false && (await complete()).status === 409, "A wrong answer does not count");
    await api("POST", `/api/student/lessons/${L}/checkpoint`, s1.token, { blockId: q1, answer: "b1" });
    const c1 = await complete();
    assert(c1.status === 409 && c1.json.missingBlockIds.length === 1 && c1.json.missingBlockIds[0] === q2 && /1 remaining question\b/.test(c1.json.error), "After one correct answer, 1 question remains");
    await api("POST", `/api/student/lessons/${L}/checkpoint`, s1.token, { blockId: q2, answer: "c2" });
    const c2 = await complete();
    assert(c2.status === 200, "With every question answered correctly the lesson can be completed");
    const done = await stateOf(L);
    assert(done.state === "COMPLETED" && done.progressPercentage === 100 && !!done.completedAt, "...and is recorded as COMPLETED at 100%");
    assert((await complete()).status === 200 && (await stateOf(L)).state === "COMPLETED", "Completing again is harmless");
    const sess2 = await api("GET", `/api/student/lessons/${L}/session`, s1.token);
    assert(sess2.json.data.session.completedBlockIds.includes(q1) && sess2.json.data.session.completedBlockIds.includes(q2), "The session now lists both answered questions");

    section("5. Lessons whose questions cannot be answered do not trap students");
    const L2 = await mkLesson(T1, `P28 Lesson Two ${run}`);
    await addBlock(T1, L2, "TEXT", "Just reading", "Read");
    const qb = (await addBlock(T1, L2, "CHECKPOINT", "Will break", "Q", meta({ options: ["x", "y"], correctAnswer: "x" }))).json.data.id as string;
    await publish(T1, L2);
    await api("PUT", `/api/lessons/${L2}/blocks/${qb}`, T1, { metadata: meta({ options: ["x"] }) }); // broken after publication
    const L2state = async () => (await path(s1.token)).learningPath.find((n: any) => n.lessonId === L2);
    assert((await L2state())?.state === "AVAILABLE", "The next lesson is unlocked");
    const cb = await api("POST", "/api/student/progress", s1.token, { lessonId: L2, action: "COMPLETE" });
    assert(cb.status === 200 && (await L2state()).state === "COMPLETED", "A lesson whose only question is broken (cannot be answered) can still be completed");
    const L3 = await mkLesson(T1, `P28 Lesson Three ${run}`);
    await addBlock(T1, L3, "TEXT", "Only reading", "Read");
    await publish(T1, L3);
    assert((await api("POST", "/api/student/progress", s1.token, { lessonId: L3, action: "COMPLETE" })).status === 200, "A reading-only lesson completes as before");
  } finally {
    await stop();
  }

  console.log(`\n======================================================\nPHASE 28 RESULTS (${DB_MODE ? "PostgreSQL" : "in-memory"}): ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("ALL PHASE 28 CHECKS PASSED (see docs/PHASE_28_VERIFICATION.md for what is NOT covered).");
  process.exit(0);
}
main().catch((e) => { console.error("Phase 28 suite crashed:", e); process.exit(1); });

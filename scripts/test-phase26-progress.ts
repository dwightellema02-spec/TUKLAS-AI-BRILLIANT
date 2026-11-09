/**
 * Tuklas AI - Phase 26: student learning path and progress, black-box over HTTP.
 * Same suite for both stores:
 *   in-memory:   AI_PROVIDER=local npx tsx scripts/test-phase26-progress.ts
 *   PostgreSQL:  DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase26-progress.ts
 * (scripts/test-phase26-prisma.ts prepares a clean database and adds database-level checks.)
 * Set RESTART_CHECK=1 (PostgreSQL only) to also prove progress survives a server restart.
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p26.${t}.${run}@example.edu`;

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => {
  if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); }
};
const section = (t: string) => console.log(`\n--- ${t} ---`);

async function main() {
  const port = 3500 + Math.floor(Math.random() * 90);
  const base = `http://127.0.0.1:${port}`;
  const secret = crypto.randomBytes(32).toString("hex");
  let server: ChildProcess | undefined;
  const start = async () => {
    server = spawn("npx", ["tsx", "server.ts"], {
      env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: secret },
      stdio: ["ignore", "ignore", "ignore"],
      detached: true,
    });
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* waiting */ }
    }
    throw new Error("server did not start");
  };
  const stop = async () => { try { if (server?.pid) process.kill(-server.pid, "SIGTERM"); } catch { /* already gone */ } await new Promise((r) => setTimeout(r, 1500)); };

  const api = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
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
    console.log(`Server up (${DB_MODE ? "PostgreSQL" : "in-memory"} mode)`);

    section("0. Setup through real flows");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    assert(!!admin, "Administrator signs in");
    await api("POST", "/api/admin/users", admin, { name: "Teacher P26", email: email("t"), password: PASSWORD, role: "TEACHER", verifyMathematics: true });
    const T = await login(email("t"), PASSWORD);
    const reg = async (tag: string) => {
      const r = await api("POST", "/api/auth/register", undefined, { name: `Student ${tag}`, email: email(tag), password: PASSWORD });
      return { token: r.json.token as string, id: r.json.user.id as string, email: email(tag) };
    };
    const s1 = await reg("s1"), s2 = await reg("s2");
    assert(!!s1.token && !!s2.token, "Two students registered");

    const cur = await api("GET", "/api/curriculum", T);
    const unit = cur.json.data?.[0]?.grades?.[0]?.terms?.[0]?.units?.[0];
    assert(!!unit?.id, "The curriculum has a unit to add lessons to");
    const mkLesson = async (title: string, publish: boolean) => {
      const r = await api("POST", "/api/lessons", T, { title, unitId: unit.id, learningObjectives: ["Test objective"] });
      const id = r.json.data?.id as string;
      if (publish) for (const st of ["REVIEW", "APPROVED", "PUBLISHED"]) await api("POST", `/api/lessons/${id}/status`, T, { targetStatus: st });
      return id;
    };
    const A = await mkLesson(`P26 Lesson A ${run}`, true);
    const B = await mkLesson(`P26 Lesson B ${run}`, true);
    const D = await mkLesson(`P26 Draft ${run}`, false);
    assert(!!A && !!B && !!D && A !== B, "Teacher created lessons A and B (published) and a draft");

    const path = async (tok: string) => (await api("GET", "/api/student/learning-path", tok)).json.data;
    const node = (p: any, id: string) => p.learningPath.find((n: any) => n.lessonId === id);

    section("1. The learning path is built from the real store");
    let p1 = await path(s1.token);
    assert(!!p1 && typeof p1.curriculum.subject === "string" && p1.curriculum.subject.length > 0 && p1.curriculum.unit.title.length > 0, "Path carries subject / grade / term / unit labels");
    assert(!!node(p1, A) && !!node(p1, B), "Published lessons appear on the path");
    assert(!node(p1, D), "A DRAFT lesson never appears on a student's path");
    assert(p1.learningPath[0].state === "AVAILABLE", "The first lesson is available");
    assert(node(p1, A).state === "LOCKED" && node(p1, B).state === "LOCKED", "Later lessons are locked until the previous one is completed");
    assert(/Requires completion/.test(node(p1, B).lockReasons.join(" ")), "A locked lesson explains why");
    const ids = p1.learningPath.map((n: any) => n.lessonId);
    assert(new Set(ids).size === ids.length, "No lesson appears twice");
    if (DB_MODE) assert(!ids.some((i: string) => /^lsn_\d+$/.test(i)), "PostgreSQL mode never mixes in the demo lessons");

    section("2. Access and input guards on every student progress route");
    assert((await api("GET", `/api/student/lessons/${A}/access`, s1.token)).json.data.allowed === false, "Access check: locked lesson -> allowed:false");
    assert((await api("POST", "/api/student/progress", undefined, { lessonId: A, action: "START" })).status === 401, "Progress without sign-in -> 401");
    assert((await api("POST", "/api/student/progress", s1.token, { lessonId: A, action: "START" })).status === 403, "Cannot start a LOCKED lesson (403)");
    assert((await api("POST", "/api/student/progress", s1.token, { lessonId: A, action: "COMPLETE" })).status === 403, "Cannot mark a LOCKED lesson complete (403)");
    assert((await api("POST", "/api/student/progress", s1.token, { lessonId: D, action: "START" })).status === 404, "Cannot record progress on an unpublished DRAFT lesson (404)");
    assert((await api("POST", "/api/student/progress", s1.token, { lessonId: "does-not-exist", action: "START" })).status === 404, "Unknown lesson -> 404, not a 500");
    assert((await api("POST", "/api/student/progress", s1.token, { lessonId: ids[0], action: "DESTROY" })).status === 400, "Unknown action -> 400");
    assert((await api("POST", "/api/student/progress", s1.token, { lessonId: ids[0], action: "UPDATE_BLOCKS", completedBlockIndex: -1, totalBlocks: 4 })).status === 400, "Negative block index -> 400");
    assert((await api("POST", "/api/student/progress", s1.token, { lessonId: ids[0], action: "UPDATE_BLOCKS", completedBlockIndex: "2", totalBlocks: 4 })).status === 400, "Non-integer block index -> 400");
    assert((await api("POST", `/api/student/lessons/${A}/session`, s1.token, { isCompleted: true })).status === 403, "Cannot complete a locked lesson through the session route either");
    assert((await api("GET", `/api/student/lessons/${A}/session`, s1.token)).status === 403, "Cannot read a locked lesson's session");
    assert((await api("POST", `/api/student/lessons/${A}/checkpoint`, s1.token, { blockId: "b", answer: "1" })).status === 403, "Cannot submit a checkpoint to a locked lesson");
    p1 = await path(s1.token);
    assert(node(p1, A).state === "LOCKED" && p1.learningPath.every((n: any) => n.progressPercentage === 0), "None of the rejected calls changed any progress");

    section("3. Progress transitions");
    const first = ids[0];
    const start1 = await api("POST", "/api/student/progress", s1.token, { lessonId: first, action: "START" });
    assert(start1.status === 200, "START on the first lesson succeeds");
    let n = node(await path(s1.token), first);
    assert(n.state === "IN_PROGRESS" && n.progressPercentage > 0 && n.progressPercentage < 100 && !!n.startedAt, "...lesson is IN_PROGRESS with a start time");
    await api("POST", "/api/student/progress", s1.token, { lessonId: first, action: "UPDATE_BLOCKS", completedBlockIndex: 1, totalBlocks: 4 });
    n = node(await path(s1.token), first);
    assert(n.progressPercentage === 50, "2 of 4 blocks -> 50%");
    await api("POST", "/api/student/progress", s1.token, { lessonId: first, action: "UPDATE_BLOCKS", completedBlockIndex: 0, totalBlocks: 4 });
    assert(node(await path(s1.token), first).progressPercentage === 50, "Going back to an earlier block never lowers progress");
    await Promise.all(Array.from({ length: 8 }, () => api("POST", "/api/student/progress", s1.token, { lessonId: first, action: "UPDATE_BLOCKS", completedBlockIndex: 2, totalBlocks: 4 })));
    const afterRace = await path(s1.token);
    assert(afterRace.learningPath.filter((x: any) => x.lessonId === first).length === 1 && node(afterRace, first).progressPercentage === 75, "8 concurrent updates leave one consistent record at 75%");
    const s2path = await path(s2.token);
    assert(node(s2path, first).progressPercentage === 0 && node(s2path, first).state === "AVAILABLE", "Another student's progress is untouched");

    // Complete every lesson before A (in order), then A, through the real routes
    let guard = 0;
    while (node(await path(s1.token), A).state === "LOCKED" && guard++ < 40) {
      const cur = (await path(s1.token)).learningPath.find((x: any) => x.state !== "COMPLETED");
      await answerAllQuestions(s1.token, cur.lessonId);
      const r = await api("POST", "/api/student/progress", s1.token, { lessonId: cur.lessonId, action: "COMPLETE" });
      if (r.status !== 200) { assert(false, `could not complete ${cur.lessonId}: ${r.status}`); break; }
    }
    let pA = await path(s1.token);
    assert(node(pA, A).state === "AVAILABLE" && node(pA, B).state === "LOCKED", "Completing the earlier lessons unlocks A and only A");
    const doneNode = pA.learningPath[0];
    assert(doneNode.state === "COMPLETED" && doneNode.progressPercentage === 100 && !!doneNode.completedAt, "A completed lesson is 100% with a completion time");
    const again = await api("POST", "/api/student/progress", s1.token, { lessonId: doneNode.lessonId, action: "UPDATE_BLOCKS", completedBlockIndex: 0, totalBlocks: 4 });
    assert(again.status === 200 && node(await path(s1.token), doneNode.lessonId).state === "COMPLETED", "A completed lesson stays completed");

    // Completing A through the lesson-session route unlocks B
    assert((await api("POST", `/api/student/lessons/${A}/session`, s1.token, { currentSectionIndex: 1, completedBlockIds: [], isCompleted: true })).status === 200, "Lesson-session completion of an unlocked lesson works");
    pA = await path(s1.token);
    assert(node(pA, A).state === "COMPLETED" && node(pA, B).state === "AVAILABLE", "...and unlocks B");
    assert(pA.curriculum.unit.completedLessons >= 2 && pA.curriculum.unit.progressPercentage > 0, "Unit progress counts completed lessons");
    assert(pA.continueLearning?.lessonId === B || pA.nextRecommended?.lessonId === B, "Continue-learning points at the next lesson");

    section("4. Dashboard and teacher view use the same data");
    const dash = await api("GET", "/api/student/dashboard", s1.token);
    assert(dash.status === 200 && !!dash.json.data?.continueLearning, "Student dashboard loads with a continue-learning card");
    const dash2 = await api("GET", "/api/student/dashboard", s2.token);
    assert(dash2.status === 200, "A brand-new student's dashboard loads (no progress yet)");

    const cls = await api("POST", "/api/teacher/classes", T, { name: `P26 Class ${run}` });
    await api("POST", `/api/teacher/classes/${cls.json.data.id}/students`, T, { emails: [s1.email] });
    const detail = await api("GET", `/api/teacher/students/${s1.id}`, T);
    const nodes = detail.json.data?.learningPathNodes ?? [];
    assert(detail.status === 200 && nodes.find((x: any) => x.lessonId === A)?.state === "COMPLETED", "Teacher sees the enrolled student's real progress");
    assert((await api("GET", `/api/teacher/students/${s2.id}`, T)).status === 403, "Teacher cannot see a student who is not in their class");

    if (DB_MODE && process.env.RESTART_CHECK) {
      section("5. Progress survives a server restart (PostgreSQL)");
      await stop();
      await start();
      const s1b = await login(s1.email, PASSWORD);
      const pr = await path(s1b);
      assert(node(pr, A).state === "COMPLETED" && node(pr, B).state === "AVAILABLE", "After a restart the student still has their progress");
    }
  } finally {
    await stop();
  }

  console.log(`\n======================================================\nPHASE 26 RESULTS (${DB_MODE ? "PostgreSQL" : "in-memory"}): ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("ALL PHASE 26 CHECKS PASSED (see docs/PHASE_26_VERIFICATION.md for what is NOT covered).");
  process.exit(0);
}

main().catch((e) => { console.error("Phase 26 suite crashed:", e); process.exit(1); });

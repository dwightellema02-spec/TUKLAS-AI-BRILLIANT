/**
 * Tuklas AI - Phase 29: research analytics are real and scoped to the teacher's own students (nothing invented).
 *   in-memory:   AI_PROVIDER=local npx tsx scripts/test-phase29-research.ts
 *   PostgreSQL:  DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase29-research.ts
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p29.${t}.${run}@example.edu`;

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => {
  if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); }
};
const section = (t: string) => console.log(`\n--- ${t} ---`);
const meta = (o: object) => JSON.stringify(o);

async function main() {
  const port = 3800 + Math.floor(Math.random() * 90);
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

    section("1. Setup: three teachers, three classes of real students, real practice");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const t of ["t1", "t2", "t3"]) await api("POST", "/api/admin/users", admin, { name: `Teacher ${t}`, email: email(t), password: PASSWORD, role: "TEACHER" });
    const T1 = await login(email("t1"), PASSWORD), T2 = await login(email("t2"), PASSWORD), T3 = await login(email("t3"), PASSWORD);
    const reg = async (tag: string) => {
      const r = await api("POST", "/api/auth/register", undefined, { name: `Student ${tag}`, email: email(tag), password: PASSWORD });
      return { token: r.json.token as string, id: r.json.user.id as string, email: email(tag) };
    };
    const [s1, s2, s3] = [await reg("s1"), await reg("s2"), await reg("s3")];
    const C1 = (await api("POST", "/api/teacher/classes", T1, { name: `P29 Class One ${run}` })).json.data.id as string;
    const C2 = (await api("POST", "/api/teacher/classes", T2, { name: `P29 Class Two ${run}` })).json.data.id as string;
    await api("POST", `/api/teacher/classes/${C1}/students`, T1, { emails: [s1.email, s2.email] });
    await api("POST", `/api/teacher/classes/${C2}/students`, T2, { emails: [s3.email] });

    const skills = (await api("GET", "/api/skills", T1)).json.data as any[];
    const SKILL = skills[skills.length - 1].id as string; // a skill the demo data has no attempts for
    const mkQuestion = async (n: number) => (await api("POST", "/api/questions", T1, {
      type: "MULTIPLE_CHOICE", prompt: `P29 question ${n} ${run}`, skillId: SKILL, status: "PUBLISHED", difficulty: "EASY",
      questionData: { choices: [{ id: "a", text: "right" }, { id: "b", text: "wrong" }], correctAnswer: "a" },
    })).json.data.id as string;
    const qids: string[] = [];
    for (let i = 1; i <= 6; i++) qids.push(await mkQuestion(i));
    const set = (await api("POST", "/api/practice-sets", T1, { title: `P29 set ${run}`, status: "PUBLISHED", questionIds: qids, skillId: SKILL })).json.data.id as string;
    assert(qids.every(Boolean) && !!set, "Teacher One authored 6 published questions on one skill and a practice set");

    const practice = async (tok: string, correctCount: number) => {
      const ps = await api("POST", "/api/practice/start", tok, { practiceSetId: set });
      const sid = ps.json.data?.id as string;
      for (let i = 0; i < qids.length; i++) {
        await api("POST", `/api/practice/${sid}/answer`, tok, { questionId: qids[i], answer: i < correctCount ? "a" : "b", timeTakenMs: 4000 + i, hintUsed: i % 2 === 1 });
      }
      await api("POST", `/api/practice/${sid}/complete`, tok, {});
      return sid;
    };
    assert(!!(await practice(s1.token, 1)) && !!(await practice(s2.token, 1)), "Students one and two (Teacher One's class) practise: 1 correct of 6 each");
    assert(!!(await practice(s3.token, 6)), "Student three (Teacher Two's class) practises: 6 correct of 6");

    section("2. Access control");
    const research = (tok: string | undefined, path: string) => api("GET", `/api/teacher/research/${path}`, tok);
    for (const path of ["difficult-skills", "mistakes", "interventions", "time-series", "comparison", "export/attempts.csv", "export/metrics.csv", `profile/${s1.id}`]) {
      assert((await research(s1.token, path)).status === 403, `A student cannot call research/${path}`);
      assert((await research(undefined, path)).status === 403, `Signed out cannot call research/${path}`);
    }
    assert((await research(T2, `difficult-skills?classroomId=${C1}`)).status === 403, "Teacher Two cannot query Teacher One's class");
    assert((await research(T1, `time-series?classroomId=${C2}`)).status === 403, "Teacher One cannot query Teacher Two's class");
    assert((await research(T1, "mistakes?classroomId=does-not-exist")).status === 404, "An unknown class -> 404");
    assert((await research(T2, `profile/${s1.id}`)).status === 403, "Teacher Two cannot open Teacher One's student's profile");
    assert((await research(T1, `profile/${s3.id}`)).status === 403, "Teacher One cannot open Teacher Two's student's profile");
    assert((await research(admin, "profile/does-not-exist")).status === 404, "Unknown student -> 404 (not an invented 'Juan de la Cruz')");

    section("3. Teacher One sees exactly their own students' real data");
    const profile = await research(T1, `profile/${s1.id}`);
    assert(profile.status === 200 && profile.json.data.studentName === "Student s1" && profile.json.data.attemptCount === 6, "Profile: the student's real name and exactly their 6 attempts");
    assert(Math.abs(profile.json.data.metrics.accuracy.value - 1 / 6) < 0.01, "Profile accuracy is the real 1/6");
    const ds1 = (await research(T1, "difficult-skills")).json.data as any[];
    const mine = ds1.find((d) => d.skillId === SKILL);
    assert(!!mine && mine.evidenceCount === 12 && mine.totalStudentsEvaluated === 2 && mine.affectedStudentCount === 2 && Math.abs(mine.accuracy - 2 / 12) < 0.001, "Difficult skills: 12 attempts, 2 students, both affected, accuracy 2/12");
    assert(mine.hintDependenceRate === 0.5, "...and the real hint rate (every other answer used a hint = 50%)");
    assert(/below the 65% baseline/.test(mine.flagReason), "...with a reason that states the real figures");
    assert((await research(T1, `difficult-skills?classroomId=${C1}`)).json.data.some((d: any) => d.skillId === SKILL), "The same through the class filter");
    const ds2 = (await research(T2, "difficult-skills")).json.data as any[];
    assert(!ds2.some((d) => d.skillId === SKILL), "Teacher Two (1 student, all correct) sees no difficult skill: one student is not enough evidence");
    const ts1 = (await research(T1, "time-series")).json.data as any[];
    assert(ts1.reduce((n, p) => n + p.attemptCount, 0) === 12 && ts1.every((p) => p.understanding === null && p.application === null && p.consistency === null), "Time series: Teacher One's 12 attempts; per-day understanding/application/consistency are not invented");
    const ts2 = (await research(T2, "time-series")).json.data as any[];
    assert(ts2.reduce((n, p) => n + p.attemptCount, 0) === 6 && ts2.every((p) => p.accuracy === 1), "Teacher Two's series: 6 attempts, accuracy 100%");
    const tsAdmin = (await research(admin, "time-series")).json.data as any[];
    assert(tsAdmin.reduce((n, p) => n + p.attemptCount, 0) >= 18, "An administrator sees everyone (at least all 18)");

    const csv1 = (await research(T1, "export/attempts.csv")).text;
    const csv2 = (await research(T2, "export/attempts.csv")).text;
    const csvAdmin = (await research(admin, "export/attempts.csv")).text;
    assert(csv1.includes(s1.id) && csv1.includes(s2.id) && !csv1.includes(s3.id), "attempts.csv for Teacher One: their students only");
    assert(csv2.includes(s3.id) && !csv2.includes(s1.id) && !csv2.includes(s2.id), "attempts.csv for Teacher Two: their student only");
    assert(csvAdmin.includes(s1.id) && csvAdmin.includes(s3.id), "attempts.csv for an administrator: everyone");
    assert(csv1.trim().split("\n").length === 13 && csv1.includes("Student s1") && csv1.includes("Student s2"), "...12 data rows with each student's real name (no hard-coded name)");
    const m1 = (await research(T1, "export/metrics.csv")).text;
    assert(m1.includes("Student s1") && m1.includes("Student s2") && !m1.includes("Student s3") && !m1.includes("Juan de la Cruz"), "metrics.csv: one profile per student in scope, real names");

    section("4. No data means no numbers");
    const cmp = (await research(T1, "comparison")).json.data;
    assert(cmp.comparison.observedTrend === "INSUFFICIENT_DATA" && cmp.preTest.averageScorePercent === null && cmp.postTest.averageScorePercent === null && cmp.comparison.scoreDifferencePoints === null, "Pre/post with no graded results of these students: null averages and INSUFFICIENT_DATA (was a hard-coded 65% -> 88%)");
    assert(cmp.preTest.totalStudents === 0 && cmp.skillBreakdown.length === 0, "...zero students and no skill rows (was 1 student and three invented skills)");
    const cmpClass = (await research(T1, `comparison?classroomId=${C1}`)).json.data;
    assert(cmpClass.classroomName === `P29 Class One ${run}`, "The comparison carries the real class name (was always 'Section Mabini')");
    const cmpCsv = (await research(T1, "export/comparison.csv")).text;
    assert(!/65\.0|88\.0|Mabini/.test(cmpCsv), "comparison.csv contains none of the old made-up figures");
    const mist = (await research(T1, "mistakes")).json.data as any[];
    assert(Array.isArray(mist) && mist.every((m) => m.count > 0 && m.affectedStudentCount >= 1) && (mist.length === 0 || Math.abs(mist.reduce((n, m) => n + m.percentage, 0) - 100) < 0.5), "Mistake analytics: only recorded categories, percentages add up to 100%");
    const intv = (await research(T1, "interventions")).json.data as any[];
    assert(Array.isArray(intv) && intv.every((i) => i.beforeEvidence.attempts >= 3 && i.afterEvidence.attempts >= 3), "Interventions: only observations with >=3 attempts on each side (none were invented)");

    section("5. A teacher with no students gets nothing");
    for (const path of ["difficult-skills", "mistakes", "interventions", "time-series"]) {
      const r = await research(T3, path);
      assert(r.status === 200 && r.json.data.length === 0, `Teacher Three (no classes): research/${path} is empty`);
    }
    assert((await research(T3, "export/attempts.csv")).text.trim().split("\n").length === 1, "...attempts.csv is a header row only");
    assert((await research(T3, "comparison")).json.data.comparison.observedTrend === "INSUFFICIENT_DATA", "...and the comparison has no data");
  } finally {
    await stop();
  }

  console.log(`\n======================================================\nPHASE 29 RESULTS (${DB_MODE ? "PostgreSQL" : "in-memory"}): ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("ALL PHASE 29 CHECKS PASSED (see docs/PHASE_29_VERIFICATION.md for what is NOT covered).");
  process.exit(0);
}
main().catch((e) => { console.error("Phase 29 suite crashed:", e); process.exit(1); });

/**
 * Tuklas AI - Phase 36: teacher analytics from evidence (master plan Modules 18 and 19).
 *   AI_PROVIDER=local npx tsx scripts/test-phase36-analytics.ts
 * Part 1: the pure rules with made-up students and fixed dates. Part 2: a real class over HTTP (practice, assessments, tutor).
 * WHAT THIS PROVES: the flags, statuses and recommendations follow the stated rules and the data. It does NOT prove the thresholds
 * (50%, 65%, 14 days, ...) are the right ones for a real class: they are starting points a teacher should review.
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { buildSupportSignals, buildGroupRecommendations, studentStatus, THRESHOLDS, type StudentEvidence } from "../src/lib/teacher/class-evidence";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const run = crypto.randomBytes(3).toString("hex");
let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);

const NOW = new Date("2026-10-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
let uid = 0;
function student(over: Partial<StudentEvidence> & { practice?: Partial<StudentEvidence["practice"]> } = {}): StudentEvidence {
  const { practice, ...rest } = over;
  return {
    id: `s${++uid}`, name: `Student ${uid}`, classroomIds: ["c1"], classroomName: "Class 1", enrolledAt: daysAgo(30), lastActivityAt: daysAgo(1),
    lessonsStarted: 1, lessonsCompleted: 0,
    practice: { sessions: 0, questions: 0, correct: 0, recent: [], ...practice },
    assessments: [], masteries: [], mistakes: [], tutor: { lastAt: null, conversations: 0, studentMessages: 0, flagged: [] },
    ...rest,
  };
}
const withPractice = (q: number, c: number, extra: Partial<StudentEvidence> = {}) => student({ practice: { sessions: 2, questions: q, correct: c, recent: [{ at: daysAgo(2), questions: q / 2, correct: c / 2 }, { at: daysAgo(1), questions: q / 2, correct: c / 2 }] }, ...extra });
const sig = (e: StudentEvidence) => buildSupportSignals([e], NOW)[0];
const MASTERY = (id: string, title: string, status: string, accuracy: number, n = 6) => ({ skillId: id, skillTitle: title, status, accuracy, attemptCount: n });

function unitTests() {
  section("1. Practice accuracy");
  assert(!sig(withPractice(10, 9)), "9 of 10 right: no flag");
  const low = sig(withPractice(10, 4));
  assert(low?.severity === "HIGH" && low.signalType === "LOW_ACCURACY" && low.evidence[0].includes("4 of 10 questions right (40%)"), `4 of 10: HIGH, and the numbers are in the text ("${low?.evidence[0]}")`);
  assert(!sig(withPractice(4, 1)), "1 of 4: too little evidence to label (needs 5 questions)");
  assert(sig(withPractice(10, 6))?.severity === "MEDIUM", "6 of 10 (60%): MEDIUM");
  assert(!sig(withPractice(20, 13)), "13 of 20 (65%): at the line, not flagged");
  assert(sig(withPractice(20, 12))?.severity === "MEDIUM", "12 of 20 (60%): flagged");
  assert(sig(withPractice(10, 4)) !== undefined && sig(withPractice(10, 5))?.severity === "MEDIUM", "5 of 10 (50%) is MEDIUM, 4 of 10 is HIGH");

  section("2. Assessments");
  const A = (type: string, score: number, passed: boolean, title = "Quiz 1", at = daysAgo(2)) => ({ assessmentId: `a-${title}-${type}`, title, type, scorePercent: score, isPassed: passed, submittedAt: at });
  assert(!sig(student({ assessments: [A("PRE_TEST", 15, false, "Pre-test")] })), "A low PRE-test is a baseline, never a flag");
  assert(sig(student({ assessments: [A("FORMATIVE", 40, false)] }))?.severity === "HIGH", "Quiz 40%: HIGH");
  assert(sig(student({ assessments: [A("SUMMATIVE", 65, false, "Unit test")] }))?.severity === "MEDIUM", "Unit test 65% below the pass mark: MEDIUM");
  assert(!sig(student({ assessments: [A("SUMMATIVE", 65, true, "Unit test")] })), "65% at or above the pass mark: no flag");
  assert(!sig(student({ assessments: [A("FORMATIVE", 30, false, "Quiz 1", daysAgo(9)), A("FORMATIVE", 90, true, "Quiz 1", daysAgo(1))] })), "A retake counts: only the LATEST result of each assessment matters");
  assert(sig(student({ assessments: [A("POST_TEST", 40, false, "Post-test")] }))?.severity === "HIGH", "A low POST-test is a flag");

  section("3. Mistake patterns, tutor, declining, activity");
  const m3 = student({ mistakes: [1, 2, 3].map(() => ({ category: "SIGN_ERROR", skillId: "k1", skillTitle: "Adding Integers" })) });
  const rm = sig(m3);
  assert(rm?.signalType === "REPEATED_MISTAKES" && rm.evidence[0].includes("3 times") && rm.suggestedAction.includes("sign errors") && rm.suggestedAction.includes("Adding Integers"), `Three sign errors in one skill: named, counted, and the action says what to practise ("${rm?.suggestedAction}")`);
  assert(!sig(student({ mistakes: [1, 2].map(() => ({ category: "SIGN_ERROR" })) })), "Two of the same pattern: not yet");
  assert(!sig(student({ mistakes: [1, 2, 3, 4].map(() => ({ category: "UNKNOWN" })) })), "'Unclear pattern' diagnoses are never turned into a flag");
  assert(sig(student({ tutor: { lastAt: daysAgo(2), conversations: 1, studentMessages: 8, flagged: [{ updatedAt: daysAgo(2), reasons: ["said they were confused 5 times in a row"] }] } }))?.severity === "HIGH", "A tutor flag in the last 14 days: HIGH");
  assert(!sig(student({ tutor: { lastAt: daysAgo(20), conversations: 1, studentMessages: 8, flagged: [{ updatedAt: daysAgo(20), reasons: ["x"] }] }, lastActivityAt: daysAgo(1) })), "A tutor flag from 20 days ago has expired");
  const stale = sig(student({ lastActivityAt: daysAgo(20) }));
  assert(stale?.signalType === "INSUFFICIENT_ACTIVITY" && stale.evidence[0].includes("20 days"), `20 days without activity: flagged with the number ("${stale?.evidence[0]}")`);
  assert(!sig(student({ lastActivityAt: daysAgo(20), tutor: { lastAt: daysAgo(1), conversations: 1, studentMessages: 3, flagged: [] } })), "Recent tutor use counts as activity (no 'inactive' flag)");
  assert(!sig(student({ lastActivityAt: daysAgo(20), assessments: [A("FORMATIVE", 90, true, "Quiz", daysAgo(2))] })), "A recent assessment counts as activity");
  assert(sig(student({ lastActivityAt: null, enrolledAt: daysAgo(5) }))?.signalType === "NOT_STARTED", "Joined 5 days ago, nothing done: NOT_STARTED (LOW)");
  assert(!sig(student({ lastActivityAt: null, enrolledAt: daysAgo(1) })), "Joined yesterday, nothing yet: not flagged");
  const declining = student({ practice: { sessions: 5, questions: 25, correct: 18, recent: [{ at: daysAgo(10), questions: 5, correct: 5 }, { at: daysAgo(8), questions: 5, correct: 5 }, { at: daysAgo(6), questions: 5, correct: 4 }, { at: daysAgo(2), questions: 5, correct: 2 }, { at: daysAgo(1), questions: 5, correct: 2 }] } });
  const d = sig(declining);
  assert(d?.evidence.some((t) => /dropped/.test(t)) && d.severity === "MEDIUM", `A clear recent drop is reported ("${d?.evidence.find((t) => /dropped/.test(t))}")`);
  const dev = sig(withPractice(12, 8, { masteries: [MASTERY("k1", "Adding Integers", "DEVELOPING", 0.62), MASTERY("k2", "Absolute Value", "LEARNING", 0.5)] }));
  assert(dev?.evidence.some((t) => /Adding Integers \(62%\)/.test(t)), "Persistent 'developing' names the skills with their accuracy");
  assert(!sig(student({ masteries: [MASTERY("k1", "Adding Integers", "DEVELOPING", 0.4, 2)] })), "Mastery with fewer than 3 attempts is not used");

  section("4. One entry per student, strongest first, nothing dropped");
  const many: StudentEvidence[] = [];
  for (let i = 0; i < 40; i++) many.push(i % 4 === 0 ? withPractice(10, 3) : i % 4 === 1 ? withPractice(10, 6) : i % 4 === 2 ? student({ lastActivityAt: null, enrolledAt: daysAgo(9) }) : withPractice(10, 9));
  const all = buildSupportSignals(many, NOW);
  assert(all.length === 30, `40 students, 30 with a concern: all 30 are returned (got ${all.length}), none silently cut`);
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
  assert(all.every((x, i) => i === 0 || rank[all[i - 1].severity] >= rank[x.severity]), "Sorted HIGH, then MEDIUM, then LOW");
  assert(new Set(all.map((x) => x.studentId)).size === all.length, "Each student appears once, with all their evidence lines");
  const combo = sig(withPractice(10, 3, { assessments: [A("FORMATIVE", 30, false)], mistakes: [1, 2, 3].map(() => ({ category: "SIGN_ERROR", skillTitle: "Adding Integers" })) }));
  assert(combo.evidence.length >= 3 && combo.severity === "HIGH", "A student with several problems gets one entry listing them all");

  section("5. Group recommendations");
  const grp = (n: number, total: number, withMistake = true) => Array.from({ length: total }, (_, i) => student({ masteries: [MASTERY("k1", "Adding Integers", i < n ? "DEVELOPING" : "PROFICIENT", i < n ? 0.5 : 0.9)], mistakes: i < n && withMistake ? [{ category: "SIGN_ERROR", skillId: "k1", skillTitle: "Adding Integers" }, { category: "SIGN_ERROR", skillId: "k1", skillTitle: "Adding Integers" }] : [] }));
  const g = buildGroupRecommendations(grp(3, 8));
  assert(g.length === 1 && g[0].studentCount === 3 && g[0].commonMistake?.category === "SIGN_ERROR" && /3 of 8/.test(g[0].evidence) && /sign errors/.test(g[0].suggestedAction), `3 of 8 share a difficulty: one recommendation, with the common mistake (${g[0]?.evidence})`);
  assert(g[0].students.length === 3 && g[0].students.every((s) => s.name.startsWith("Student")), "...naming the students");
  assert(buildGroupRecommendations(grp(1, 8)).length === 0, "One struggling student is not a group problem");
  assert(buildGroupRecommendations(grp(2, 4)).length === 1, "2 of 4 (at least a third) is");
  assert(buildGroupRecommendations(grp(2, 10)).length === 0, "2 of 10 is not");
  assert(buildGroupRecommendations(grp(3, 6, false))[0]?.commonMistake === undefined, "No diagnosed pattern: none is invented");
  const unknownOnly = Array.from({ length: 5 }, (_, i) => student({ masteries: [MASTERY("k1", "Adding Integers", i < 3 ? "DEVELOPING" : "PROFICIENT", i < 3 ? 0.5 : 0.9)], mistakes: i < 3 ? [{ category: "UNKNOWN", skillId: "k1", skillTitle: "Adding Integers" }] : [] }));
  assert(buildGroupRecommendations(unknownOnly)[0]?.commonMistake === undefined, "'Unclear pattern' diagnoses are not offered as the group's common mistake");
  const fewAttempts = Array.from({ length: 6 }, () => student({ masteries: [MASTERY("k1", "Adding Integers", "LEARNING", 0.3, 2)] }));
  assert(buildGroupRecommendations(fewAttempts).length === 0, "Skills judged on fewer than 3 attempts are not used for group advice");

  section("6. Student status");
  assert(studentStatus(student({ lastActivityAt: null }), NOW) === "NO_DATA", "Nothing at all: NO_DATA");
  assert(studentStatus(withPractice(10, 9), NOW) === "ACTIVE", "Doing well: ACTIVE");
  assert(studentStatus(withPractice(10, 4), NOW) === "NEEDS_SUPPORT", "Low accuracy: NEEDS_SUPPORT");
  assert(studentStatus(student({ lastActivityAt: daysAgo(20), practice: { sessions: 1, questions: 10, correct: 9, recent: [{ at: daysAgo(20), questions: 10, correct: 9 }] } }), NOW) === "INACTIVE", "Good but silent for 20 days: INACTIVE");
  assert(studentStatus(student({ lastActivityAt: null, assessments: [A("FORMATIVE", 90, true)] }), NOW) === "ACTIVE", "Only an assessment, done recently: ACTIVE (not 'no data', not 'inactive')");
  assert(studentStatus(student({ assessments: [A("FORMATIVE", 30, false)] }), NOW) === "NEEDS_SUPPORT", "A failed quiz: NEEDS_SUPPORT");

  section("7. Robustness (2,000 random students)");
  let s = 987654321; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const rnd: StudentEvidence[] = [];
  for (let i = 0; i < 2000; i++) {
    const q = Math.floor(r() * 40), c = Math.floor(r() * (q + 1));
    rnd.push(student({
      lastActivityAt: r() < 0.2 ? null : daysAgo(Math.floor(r() * 40)), enrolledAt: r() < 0.1 ? null : daysAgo(Math.floor(r() * 60)),
      practice: { sessions: q ? Math.ceil(q / 5) : 0, questions: q, correct: c, recent: q ? [{ at: daysAgo(Math.floor(r() * 30)), questions: q, correct: c }] : [] },
      assessments: r() < 0.5 ? [A(["FORMATIVE", "PRE_TEST", "POST_TEST", "SUMMATIVE"][Math.floor(r() * 4)], Math.floor(r() * 101), r() < 0.5, `T${Math.floor(r() * 3)}`)] : [],
      mistakes: Array.from({ length: Math.floor(r() * 6) }, () => ({ category: ["SIGN_ERROR", "UNKNOWN", "CALCULATION_ERROR"][Math.floor(r() * 3)], skillTitle: r() < 0.5 ? "Adding Integers" : undefined })),
      tutor: { lastAt: r() < 0.5 ? daysAgo(Math.floor(r() * 30)) : null, conversations: 1, studentMessages: 3, flagged: r() < 0.1 ? [{ updatedAt: daysAgo(Math.floor(r() * 30)), reasons: ["x"] }] : [] },
    }));
  }
  let bad = 0;
  const before = JSON.stringify(rnd);
  const outAll = buildSupportSignals(rnd, NOW);
  for (const x of outAll) {
    if (x.evidence.length < 1 || x.details !== x.evidence[0] || !x.suggestedAction || /undefined|NaN|null|\[object/.test(`${x.details} ${x.evidence.join(" ")} ${x.suggestedAction}`)) bad++;
  }
  assert(bad === 0, `Every one of ${outAll.length} signals has evidence, a first line equal to its summary, an action, and no 'undefined'/'NaN' text`);
  assert(JSON.stringify(rnd) === before, "The input is not modified");
  assert(JSON.stringify(buildSupportSignals(rnd, NOW)) === JSON.stringify(outAll), "Same input, same output (deterministic)");
  assert(rnd.every((e) => ["ACTIVE", "NEEDS_SUPPORT", "INACTIVE", "NO_DATA"].includes(studentStatus(e, NOW))), "Every student gets one of the four statuses");
  assert(THRESHOLDS.minPracticeQuestions === 5 && THRESHOLDS.inactiveDays === 14, "(thresholds are exported so a teacher-facing setting can adopt them later)");
}

async function main() {
  unitTests();

  const port = 5900 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
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
    for (const t of ["t1", "t2"]) await api("POST", "/api/admin/users", admin, { name: `Teacher ${t}`, email: `p36.${t}.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER" });
    const T1 = await login(`p36.t1.${run}@example.edu`, "Sturdy-Pass1"), T2 = await login(`p36.t2.${run}@example.edu`, "Sturdy-Pass1");
    const mk = async (n: string) => { const r = await api("POST", "/api/auth/register", undefined, { name: `Stu ${n}`, email: `p36.${n}.${run}@example.edu`, password: "Sturdy-Pass1" }); return { token: r.json.token as string, id: r.json.user.id as string, name: `Stu ${n}` }; };

    section("8. A real class over HTTP");
    const strong = await mk("strong"), sign = await mk("sign"), idle = await mk("idle"), assessOnly = await mk("assessonly"), confused = await mk("confused"), other = await mk("other");
    const C1 = (await api("POST", "/api/teacher/classes", T1, { name: "Class One", gradeLevel: 7 })).json.data;
    const C2 = (await api("POST", "/api/teacher/classes", T2, { name: "Class Two", gradeLevel: 7 })).json.data;
    const code = async (tok: string, c: any) => (await api("GET", `/api/teacher/classes/${c.id}`, tok)).json.data.classroom?.joinCode ?? c.joinCode;
    const c1 = await code(T1, C1), c2 = await code(T2, C2);
    for (const s of [strong, sign, idle, assessOnly, confused]) await api("POST", "/api/student/classes/join", s.token, { code: c1 });
    await api("POST", "/api/student/classes/join", other.token, { code: c2 });

    // the skill a student with no history is pointed at (the first skill of the first lesson on their path), so the evidence below lands on
    // the skill the recommendation engine will actually look at; with a multi-lesson curriculum /api/skills[0] is not necessarily that one
    const skillId = ((await api("GET", "/api/student/adaptive/recommendation", idle.token)).json.data?.skillId ?? (await api("GET", "/api/skills", T1)).json.data?.[0]?.id) as string | undefined;
    const qids: string[] = [];
    const answers = [-5, -3, 4, -7, 2, -1];
    for (const [i, a] of answers.entries()) qids.push((await api("POST", "/api/questions", T1, { type: "NUMERIC_INPUT", prompt: `P36 q${i + 1} ${run}`, status: "PUBLISHED", difficulty: "EASY", skillId, questionData: { correctAnswer: a } })).json.data.id);
    const set = (await api("POST", "/api/practice-sets", T1, { title: `P36 set ${run}`, status: "PUBLISHED", questionIds: qids })).json.data;
    const doPractice = async (s: { token: string }, answerFor: (i: number) => number | string) => {
      const st = await api("POST", "/api/practice/start", s.token, { practiceSetId: set.id });
      const sid = st.json.data.id;
      const qs: any[] = st.json.data.questions ?? [];
      for (const [i, q] of qs.entries()) await api("POST", `/api/practice/${sid}/answer`, s.token, { questionId: q.questionId ?? q.question?.id ?? q.id, answer: String(answerFor(qids.indexOf(q.questionId ?? q.question?.id ?? q.id) >= 0 ? qids.indexOf(q.questionId ?? q.question?.id ?? q.id) : i)) });
      await api("POST", `/api/practice/${sid}/complete`, s.token, {});
    };
    await doPractice(strong, (i) => answers[i]);
    await doPractice(sign, (i) => Math.abs(answers[i]) + 100); // every answer wrong

    const mkAsm = async (title: string, type: string) => {
      const a = (await api("POST", "/api/teacher/assessments", T1, { title, type, passingScorePercent: 60, questions: qids.slice(0, 3).map((questionId) => ({ questionId })) })).json.data;
      await api("POST", `/api/teacher/assessments/${a.id}/publish`, T1);
      await api("POST", `/api/teacher/assessments/${a.id}/assign`, T1, { classroomId: C1.id });
      return a;
    };
    const quiz = await mkAsm(`P36 quiz ${run}`, "FORMATIVE");
    const pre = await mkAsm(`P36 pre ${run}`, "PRE_TEST");
    const take = async (s: { token: string }, a: any, right: number) => {
      const view = (await api("GET", `/api/student/assessments/${a.id}`, s.token)).json.data;
      const att = (await api("POST", `/api/student/assessments/${a.id}/start`, s.token)).json.data.attemptId;
      const responses = view.items.map((it: any, i: number) => ({ assessmentItemId: it.id, studentAnswer: i < right ? String(answers[qids.indexOf(it.questionId)]) : "999" }));
      await api("POST", `/api/student/assessments/attempts/${att}/submit`, s.token, { responses });
    };
    await take(strong, quiz, 3); await take(assessOnly, quiz, 1); await take(assessOnly, pre, 0); await take(strong, pre, 1);

    // a student who keeps saying they do not understand: the tutor flags the conversation for the teacher
    for (let i = 0; i < 7; i++) await api("POST", "/api/ai/tutor", confused.token, { helpLevel: "LEVEL_1_HINT", questionId: qids[0], studentQuery: i === 0 ? "what is this" : "I don't understand" });

    const dash = (tok: string, q = "") => api("GET", `/api/teacher/dashboard${q}`, tok);
    const D = (await dash(T1)).json.data;
    const byName = (n: string) => D.needsAttention.find((x: any) => x.studentName === n);
    assert(!!byName(sign.name) && byName(sign.name).severity === "HIGH" && /0 of 6/.test(byName(sign.name).evidence.join(" ")), `The student who got every practice answer wrong is HIGH with the numbers (${byName(sign.name)?.evidence?.[0]})`);
    assert(!!byName(assessOnly.name) && byName(assessOnly.name).severity === "HIGH" && byName(assessOnly.name).evidence.some((e: string) => /33%|34%/.test(e)), `The student who only took a quiz and scored 1 of 3 is flagged from the QUIZ (${byName(assessOnly.name)?.details})`);
    assert(byName(assessOnly.name) && !byName(assessOnly.name).evidence.some((e: string) => /pre/i.test(e)), "...and their 0% pre-test is not held against them");
    assert(!byName(strong.name), "The strong student is not flagged");
    assert(!!byName(confused.name) && byName(confused.name).signalType === "TUTOR_FLAGGED", `The student the tutor flagged appears with that reason (${byName(confused.name)?.details})`);
    assert(!byName(idle.name), "A student who joined moments ago and has done nothing is not flagged yet (3-day grace)");
    assert(D.needsAttentionTotal === D.needsAttention.length && D.needsAttention.length === 3, `The list is complete: ${D.needsAttention.length} flagged = total ${D.needsAttentionTotal}`);
    assert(D.needsAttention.every((x: any, i: number) => i === 0 || ({ HIGH: 3, MEDIUM: 2, LOW: 1 } as any)[D.needsAttention[i - 1].severity] >= ({ HIGH: 3, MEDIUM: 2, LOW: 1 } as any)[x.severity]), "Sorted by severity");
    const list = (await api("GET", "/api/teacher/students", T1)).json.data.students;
    const st = (n: string) => list.find((x: any) => x.name === n);
    assert(st(assessOnly.name).status === "NEEDS_SUPPORT" && st(assessOnly.name).lastActivityAt !== null, "The quiz-only student has a last-activity time and a real status (was 'no activity' before)");
    assert(st(strong.name).status === "ACTIVE" && st(idle.name).status === "NO_DATA" && st(sign.name).status === "NEEDS_SUPPORT", "Student list statuses: ACTIVE / NO_DATA / NEEDS_SUPPORT as expected");
    assert(st(confused.name).lastActivityAt !== null && st(confused.name).status !== "NO_DATA", "A student who only used the tutor still counts as active");
    const ap = D.assessmentPerformance;
    const quizRow = ap.find((x: any) => x.assessmentId === quiz.id), preRow = ap.find((x: any) => x.assessmentId === pre.id);
    assert(quizRow?.assigned === 5 && quizRow.completed === 2 && quizRow.meanScorePercent === 66.7 && quizRow.passRate === 0.5, `Assessment performance: quiz 2 of 5 done, mean 66.7%, pass rate 50% (${JSON.stringify(quizRow)})`);
    assert(preRow?.completed === 2 && preRow.meanScorePercent === 16.7, `Pre-test: 2 done, mean 16.7% (${preRow?.meanScorePercent})`);
    assert(Array.isArray(D.lessonPerformance) && Array.isArray(D.groupRecommendations), "Lesson performance and group recommendations are present (arrays)");
    assert(D.classProgress.averageClassAccuracy === 50, `Class practice accuracy is weighted by questions: 6 right of 12 = 50% (${D.classProgress.averageClassAccuracy})`);

    section("8b. Student recommendations follow the evidence (Module 19)");
    const recOf = async (st: { token: string }) => (await api("GET", "/api/student/adaptive/recommendation", st.token)).json.data;
    const rWeak = await recOf(sign), rStrong = await recOf(strong), rNew = await recOf(idle);

    // answers from questions with no skill: the dashboard says what it cannot use
    const uq = [] as string[];
    for (const a of [3, 6]) uq.push((await api("POST", "/api/questions", T2, { type: "NUMERIC_INPUT", prompt: `P36 untagged ${a} ${run}`, status: "PUBLISHED", questionData: { correctAnswer: a } })).json.data.id);
    const uset = (await api("POST", "/api/practice-sets", T2, { title: `P36 untagged ${run}`, status: "PUBLISHED", questionIds: uq })).json.data;
    const ust = await api("POST", "/api/practice/start", other.token, { practiceSetId: uset.id });
    for (const q of ust.json.data.questions) await api("POST", `/api/practice/${ust.json.data.id}/answer`, other.token, { questionId: q.questionId ?? q.question?.id ?? q.id, answer: "1" });
    const noteDash = (await dash(T2)).json.data;
    assert(noteDash.dataNotes.length === 1 && /2 of 2 answers/.test(noteDash.dataNotes[0]) && /linked to a skill/.test(noteDash.dataNotes[0]), `Answers that cannot feed skill analytics are called out (${noteDash.dataNotes[0]})`);
    assert((await dash(T1)).json.data.dataNotes.length === 0, "...and a class whose questions are all linked to skills gets no such note");
    const recNew = await recOf(other);
    assert(rWeak?.decisionType === "PRACTICE_EASIER" && /0%/.test(rWeak.reason) && rStrong?.decisionType === "PRACTICE_HARDER" && /100%/.test(rStrong.reason), `Student guidance follows the evidence: the all-wrong student is steered to easier practice (reason cites 0%), the all-right student to harder (cites 100%) [weak: ${rWeak?.decisionType} "${rWeak?.reason}"; strong: ${rStrong?.decisionType} "${rStrong?.reason}"]`);
    assert(rNew?.decisionType === "INSUFFICIENT_EVIDENCE" && /0 attempts/.test(rNew.reason), "A student with no evidence is told there is not enough yet, not given invented advice");
    void recNew;

    section("9. Class filter, scope and detail");
    const D1 = (await dash(T1, `?classId=${C1.id}`)).json.data, D2 = (await dash(T2, `?classId=${C2.id}`)).json.data;
    assert(D1.classFilter?.name === "Class One" && D1.stats.totalStudents === 5 && D2.stats.totalStudents === 1 && D2.needsAttention.length === 0, "Filtering by class limits every figure to that class");
    assert((await dash(T1, `?classId=${C2.id}`)).status === 403, "Asking for another teacher's class -> 403");
    assert((await dash(T2)).json.data.needsAttention.length === 0 && (await dash(T2)).json.data.assessmentPerformance.length === 0, "The other teacher sees none of this class's flags or assessments");
    assert((await dash(undefined as any)).status === 403 && (await dash(strong.token)).status === 403, "Signed out and student callers are refused");
    const det = (await api("GET", `/api/teacher/students/${sign.id}`, T1)).json.data;
    assert(det.support?.severity === "HIGH" && det.support.evidence.length >= 1 && det.assessmentResults.length === 0 && det.tutorUse.conversations === 0, "Student detail shows the same evidence (support, assessments, tutor use)");
    const det2 = (await api("GET", `/api/teacher/students/${assessOnly.id}`, T1)).json.data;
    assert(det2.assessmentResults.length === 2 && det2.assessmentResults.some((a: any) => a.type === "PRE_TEST"), "A student's detail lists their latest result per assessment");
    const det3 = (await api("GET", `/api/teacher/students/${confused.id}`, T1)).json.data;
    assert(det3.tutorUse.studentMessages >= 7 && det3.tutorUse.flaggedConversations >= 1, `Tutor use is summarised (${det3.tutorUse.studentMessages} messages, ${det3.tutorUse.flaggedConversations} flagged)`);
    assert((await api("GET", `/api/teacher/students/${sign.id}`, T2)).status === 403, "Another teacher cannot open this student's detail (403)");
  } finally { try { if (server?.pid) process.kill(-server.pid, "SIGTERM"); } catch { /* */ } }
  console.log(`\n======================================================\nPHASE 36 RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

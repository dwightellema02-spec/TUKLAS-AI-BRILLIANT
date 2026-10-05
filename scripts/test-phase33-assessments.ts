/**
 * Tuklas AI - Phase 33: assessments (create, publish, assign, take, grade, results, pre/post). Black-box over HTTP.
 *   AI_PROVIDER=local npx tsx scripts/test-phase33-assessments.ts      (in-memory)
 *   DATABASE_URL=... via scripts/test-phase33-prisma.ts                  (PostgreSQL, fresh database)
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p33.${t}.${run}@example.edu`;
const KEY = `K${run}`;

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);

async function main() {
  const port = 4900 + Math.floor(Math.random() * 90);
  const base = `http://127.0.0.1:${port}`;
  const secret = crypto.randomBytes(32).toString("hex");
  let server: ChildProcess | undefined;
  const start = async () => {
    server = spawn("npx", ["tsx", "server.ts"], { env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: secret }, stdio: ["ignore", "ignore", "ignore"], detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* waiting */ } }
    throw new Error("server did not start");
  };
  const stop = async () => { try { if (server?.pid) process.kill(-server.pid, "SIGTERM"); } catch { /* gone */ } await new Promise((r) => setTimeout(r, 1500)); };
  const api = async (method: string, path: string, token?: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text(); let json: any = {}; try { json = JSON.parse(text); } catch { /* */ }
    return { status: res.status, json, text };
  };
  const login = async (e: string, p: string) => (await api("POST", "/api/auth/login", undefined, { email: e, password: p })).json.token as string;

  try {
    await start();
    console.log(`\nServer up (${DB_MODE ? "PostgreSQL" : "in-memory"} mode)`);

    section("1. Setup: admin, two teachers, three students, two classes");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const t of ["t1", "t2"]) await api("POST", "/api/admin/users", admin, { name: `Teacher ${t}`, email: email(t), password: PASSWORD, role: "TEACHER" });
    const T1 = await login(email("t1"), PASSWORD), T2 = await login(email("t2"), PASSWORD);
    const mkStudent = async (t: string) => { const r = await api("POST", "/api/auth/register", undefined, { name: `Student ${t}`, email: email(t), password: PASSWORD }); return { token: r.json.token as string, id: r.json.user.id as string }; };
    const S1 = await mkStudent("s1"), S2 = await mkStudent("s2"), S3 = await mkStudent("s3");
    const C1 = (await api("POST", "/api/teacher/classes", T1, { name: "Grade 7 A", gradeLevel: 7 })).json.data;
    const C2 = (await api("POST", "/api/teacher/classes", T2, { name: "Grade 7 B", gradeLevel: 7 })).json.data;
    const detail = await api("GET", `/api/teacher/classes/${C1.id}`, T1);
    const code1 = detail.json.data.classroom?.joinCode ?? C1.joinCode;
    assert((await api("POST", "/api/student/classes/join", S1.token, { code: code1 })).status === 200 && (await api("POST", "/api/student/classes/join", S2.token, { code: code1 })).status === 200, "Students 1 and 2 join class 1; student 3 is in no class");

    const mkQ = async (tok: string, body: any) => { const r = await api("POST", "/api/questions", tok, { status: "PUBLISHED", difficulty: "EASY", explanation: `EXPL-${KEY}`, correctFeedback: `OK-${KEY}`, incorrectFeedback: `NO-${KEY}`, ...body }); return r.json.data?.id as string; };
    const qMC = await mkQ(T1, { type: "MULTIPLE_CHOICE", prompt: "Which is the opposite of 5?", questionData: { choices: [{ id: "a", text: "-5", isCorrect: true }, { id: "b", text: "5" }, { id: "c", text: "0" }], correctAnswer: "a" } });
    const qNum = await mkQ(T1, { type: "NUMERIC_INPUT", prompt: "Compute -3 + 8", questionData: { correctAnswer: 5 } });
    const qTF = await mkQ(T1, { type: "TRUE_FALSE", prompt: "|-4| equals 4", questionData: { correctAnswer: true } });
    const qMatch = await mkQ(T1, { type: "MATCHING", prompt: "Match each number to its absolute value", questionData: { matchingPairs: [{ left: "-2", right: "2" }, { left: "-7", right: "7" }] } });
    const qDraftT2 = await mkQ(T2, { type: "NUMERIC_INPUT", prompt: "T2 draft", status: "DRAFT", questionData: { correctAnswer: 1 } });
    const qPubT2 = await mkQ(T2, { type: "NUMERIC_INPUT", prompt: "T2 published", questionData: { correctAnswer: 2 } });
    assert([qMC, qNum, qTF, qMatch, qDraftT2, qPubT2].every(Boolean), "Six questions created");

    section("2. Creating an assessment: validation");
    const mk = (tok: string | undefined, body: any) => api("POST", "/api/teacher/assessments", tok, body);
    const ok = { title: "Integers check", type: "FORMATIVE", questions: [{ questionId: qMC }] };
    assert((await mk(undefined, ok)).status === 403 && (await mk(S1.token, ok)).status === 403, "Signed out and student callers are refused (403)");
    const bad: Array<[string, any, number]> = [
      ["short title", { ...ok, title: "ab" }, 400], ["long title", { ...ok, title: "x".repeat(121) }, 400], ["unknown type", { ...ok, type: "NONSENSE" }, 400],
      ["no questions", { ...ok, questions: [] }, 400], ["missing questions", { title: "Integers check", type: "FORMATIVE" }, 400], ["61 questions", { ...ok, questions: Array.from({ length: 61 }, (_, i) => ({ questionId: `q${i}` })) }, 400],
      ["duplicate question", { ...ok, questions: [{ questionId: qMC }, { questionId: qMC }] }, 400], ["unknown question", { ...ok, questions: [{ questionId: "nope" }] }, 404],
      ["another teacher's draft", { ...ok, questions: [{ questionId: qDraftT2 }] }, 403], ["negative points", { ...ok, questions: [{ questionId: qMC, points: -5 }] }, 400],
      ["zero points", { ...ok, questions: [{ questionId: qMC, points: 0 }] }, 400], ["huge points", { ...ok, questions: [{ questionId: qMC, points: 101 }] }, 400], ["text points", { ...ok, questions: [{ questionId: qMC, points: "lots" }] }, 400],
      ["passing 101", { ...ok, passingScorePercent: 101 }, 400], ["passing -1", { ...ok, passingScorePercent: -1 }, 400], ["time limit 0", { ...ok, timeLimitMinutes: 0 }, 400], ["time limit 301", { ...ok, timeLimitMinutes: 301 }, 400],
      ["grade 13", { ...ok, gradeLevel: 13 }, 400], ["bad cognitive level", { ...ok, questions: [{ questionId: qMC, cognitiveLevel: "GENIUS" }] }, 400], ["unknown lesson", { ...ok, lessonId: "no-such-lesson" }, 404],
      ["description too long", { ...ok, description: "d".repeat(1001) }, 400], ["title not text", { ...ok, title: 12345 }, 400],
    ];
    for (const [label, body, want] of bad) { const r = await mk(T1, body); assert(r.status === want, `${label} -> ${want} (got ${r.status}${r.json.error ? `: ${r.json.error}` : ""})`); }
    assert((await api("GET", "/api/teacher/assessments", T1)).json.data.length === 0, "None of the invalid requests created anything");
    const reuse = await mk(T1, { ...ok, title: "Uses T2's published question", questions: [{ questionId: qPubT2 }] });
    assert(reuse.status === 201, "A teacher may use another teacher's PUBLISHED question");

    section("3. Publish and assign");
    const full = { title: `Integers check ${KEY}`, description: "Opposites and absolute value", type: "FORMATIVE", passingScorePercent: 60, questions: [{ questionId: qMC, points: 1, cognitiveLevel: "KNOWLEDGE" }, { questionId: qNum, points: 2 }, { questionId: qTF }, { questionId: qMatch, points: 2, cognitiveLevel: "APPLICATION" }] };
    const A = (await mk(T1, full)).json.data;
    assert(A?.status === "DRAFT" && A.itemCount === 4 && A.totalPoints === 6, `Created as a draft with 4 items / 6 points (${A?.itemCount}/${A?.totalPoints})`);
    assert((await api("POST", `/api/teacher/assessments/${A.id}/assign`, T1, { classroomId: C1.id })).status === 409, "A draft cannot be assigned (409)");
    assert((await api("POST", `/api/teacher/assessments/${A.id}/publish`, T2)).status === 403, "Another teacher cannot publish it (403)");
    assert((await api("POST", `/api/teacher/assessments/${A.id}/publish`, S1.token)).status === 403, "A student cannot publish it (403)");
    assert((await api("POST", "/api/teacher/assessments/nope/publish", T1)).status === 404, "Publishing an unknown id -> 404");
    const pub = await api("POST", `/api/teacher/assessments/${A.id}/publish`, T1);
    assert(pub.status === 200 && pub.json.data.status === "PUBLISHED", "The author publishes it");
    assert((await api("POST", `/api/teacher/assessments/${A.id}/publish`, T1)).status === 200, "Publishing twice is harmless");
    const asg = (b: any, tok = T1) => api("POST", `/api/teacher/assessments/${A.id}/assign`, tok, b);
    assert((await asg({ classroomId: C1.id }, T2)).status === 403, "Another teacher cannot assign it (403)");
    assert((await asg({ classroomId: C2.id })).status === 403, "Assigning to a class you do not teach is refused (403)");
    assert((await asg({ classroomId: "nope" })).status === 404, "Assigning to an unknown class -> 404");
    assert((await asg({})).status === 400, "Assigning with no class -> 400");
    assert((await asg({ classroomId: C1.id, studentId: S3.id })).status === 400, "Assigning to a student who is not in the class -> 400");
    assert((await asg({ classroomId: C1.id, dueDate: "not a date" })).status === 400, "An invalid due date -> 400");
    const due = new Date(Date.now() + 7 * 86400_000).toISOString();
    assert((await asg({ classroomId: C1.id, dueDate: due })).status === 200, "The author assigns it to their class with a due date");
    assert((await asg({ classroomId: C1.id })).status === 409, "Assigning the same class twice -> 409");

    section("4. Who can see and open it");
    const stuList = (tok: string) => api("GET", "/api/student/assessments", tok);
    const l1 = await stuList(S1.token);
    const row = l1.json.data?.find((x: any) => x.id === A.id);
    assert(l1.json.data.length === 1 && row?.progress === "NOT_STARTED" && row.canStart && !!row.dueDate, "Student 1 (in the class) sees exactly this assessment, not started, with the due date");
    assert((await stuList(S2.token)).json.data.length === 1, "Student 2 (in the class) sees it too");
    assert((await stuList(S3.token)).json.data.length === 0, "Student 3 (no class) sees nothing");
    assert((await api("GET", `/api/student/assessments/${A.id}`, S3.token)).status === 404 && (await api("POST", `/api/student/assessments/${A.id}/start`, S3.token)).status === 404, "Student 3 cannot open or start it (404, same as a missing one)");
    assert((await api("GET", "/api/student/assessments/nope", S1.token)).status === 404, "A missing id gives the same 404");
    assert((await stuList(T1)).status === 403 && (await stuList(undefined as any)).status === 401, "A teacher gets 403 and a signed-out caller 401 on the student list");
    const draftOnly = (await mk(T1, { ...ok, title: `Draft only ${KEY}` })).json.data;
    assert((await api("GET", `/api/student/assessments/${draftOnly.id}`, S1.token)).status === 404, "An unpublished assessment is invisible to students");
    const view = await api("GET", `/api/student/assessments/${A.id}`, S1.token);
    assert(view.status === 200 && view.json.data.items.length === 4, "Student 1 gets the 4 questions");
    assert(!new RegExp(`isCorrect|correctAnswer|EXPL-${KEY}|OK-${KEY}|NO-${KEY}|acceptable`, "i").test(view.text), "The student's copy contains no answer key, explanation or feedback text");
    const mcItem = view.json.data.items.find((i: any) => i.questionId === qMC);
    assert(mcItem.question.options.length === 3 && mcItem.question.options.every((o: any) => o.id && o.text !== undefined && Object.keys(o).length === 2), "Choices are sent as id + text only");
    const matchView = view.json.data.items.find((i: any) => i.questionId === qMatch);
    assert(!JSON.stringify(matchView).includes('"matchingPairs"'), "Matching pairs are not sent (only shuffled halves)");

    section("5. Taking it: attempts and grading");
    const startA = (tok: string, id = A.id) => api("POST", `/api/student/assessments/${id}/start`, tok);
    const st = await startA(S1.token);
    assert(st.status === 201 && st.json.data.totalItems === 4 && !st.json.data.resumed, "Starting creates an attempt (201)");
    const st2 = await startA(S1.token);
    assert(st2.status === 200 && st2.json.data.attemptId === st.json.data.attemptId && st2.json.data.resumed, "Starting again resumes the same attempt (no duplicates)");
    const att = st.json.data.attemptId as string;
    const item = (qid: string) => view.json.data.items.find((i: any) => i.questionId === qid).id as string;
    const submit = (tok: string, id: string, responses: any) => api("POST", `/api/student/assessments/attempts/${id}/submit`, tok, { responses });
    assert((await submit(S2.token, att, [])).status === 403, "Another student cannot submit this attempt (403)");
    assert((await submit(S1.token, "nope", [])).status === 404, "An unknown attempt -> 404");
    assert((await api("POST", `/api/student/assessments/attempts/${att}/submit`, S1.token, { responses: "x" })).status === 400, "responses must be a list (400)");
    assert((await api("GET", `/api/student/assessments/attempts/${att}`, S1.token)).status === 409, "A result cannot be read before submitting (409)");
    const tampered = await submit(S1.token, att, [
      { assessmentItemId: item(qMC), studentAnswer: "a", isCorrect: true, score: 999, scoreAwarded: 999 },
      { assessmentItemId: item(qNum), studentAnswer: 5 },
      { assessmentItemId: item(qTF), studentAnswer: "false" },
      { assessmentItemId: item(qMatch), studentAnswer: { "-2": "2", "-7": "7" } },
      { assessmentItemId: "not-an-item", studentAnswer: "x" },
    ]);
    if (tampered.status !== 200) console.error("submit failed:", tampered.status, tampered.text.slice(0, 300));
    const r = tampered.json.data ?? {};
    assert(tampered.status === 200 && r.score === 5 && r.maxScore === 6 && r.scorePercent === 83.3 && r.isPassed, `Graded on the server: 5/6 = 83.3% and passed (client-sent score/isCorrect ignored): ${r?.score}/${r?.maxScore}`);
    const byQ = (qid: string) => r.responses.find((x: any) => x.questionId === qid);
    assert(byQ(qMC).isCorrect && byQ(qNum).isCorrect && !byQ(qTF).isCorrect && byQ(qMatch).isCorrect, "Choice, number (sent as a number) and matching (sent as an object) are right; the wrong true/false is wrong");
    assert(r.answersHidden === false && !!byQ(qTF).correctAnswer, "A formative assessment shows the correct answers after submitting");
    assert(r.cognitiveBreakdown.KNOWLEDGE.accuracy === 1 && r.cognitiveBreakdown.APPLICATION.accuracy === 1 && r.cognitiveBreakdown.PROCEDURAL.maxScore === 3, "Cognitive-level breakdown is computed from the stored levels");
    assert((await submit(S1.token, att, [])).status === 409, "Submitting twice -> 409");
    const again = await api("GET", `/api/student/assessments/attempts/${att}`, S1.token);
    assert(again.status === 200 && again.json.data.score === 5 && again.json.data.responses.length === 4, "The student can read their own result later");
    assert((await api("GET", `/api/student/assessments/attempts/${att}`, S2.token)).status === 404, "Another student cannot read it (404)");
    assert((await api("GET", `/api/student/assessments/attempts/${att}`, T1)).status === 403, "A teacher is not a student here (403)");
    const l2 = (await stuList(S1.token)).json.data[0];
    assert(l2.progress === "COMPLETED" && l2.scorePercent === 83.3 && l2.canStart, "The list now shows it completed with the score; a formative can be retaken");
    const retake = await startA(S1.token);
    assert(retake.status === 201 && retake.json.data.attemptId !== att, "A retake is a new attempt");
    const blank = await submit(S1.token, retake.json.data.attemptId, []);
    if (blank.status !== 200) console.error("blank submit failed:", blank.status, blank.text.slice(0, 300));
    assert(blank.json.data.score === 0 && blank.json.data.scorePercent === 0 && !blank.json.data.isPassed, "Submitting nothing scores 0 (no crash)");
    const weird = await startA(S2.token);
    const w = await submit(S2.token, weird.json.data.attemptId, [{ assessmentItemId: item(qMC), studentAnswer: ["a"] }, { assessmentItemId: item(qNum), studentAnswer: { toString: 1 } }, { assessmentItemId: item(qTF), studentAnswer: [true] }, { assessmentItemId: item(qMatch), studentAnswer: "9".repeat(5000) }]);
    assert(w.status === 200 && w.json.data.score === 0, "Odd answer shapes (the right answer wrapped in an array, an object, 5,000-character text) are graded as wrong without error");
    const raceStart = await startA(S2.token);
    const race = await Promise.all([1, 2, 3].map(() => submit(S2.token, raceStart.json.data.attemptId, [{ assessmentItemId: item(qMC), studentAnswer: "a" }])));
    const codes = race.map((x) => x.status).sort();
    assert(JSON.stringify(codes) === JSON.stringify([200, 409, 409]), `Three simultaneous submits of one attempt: exactly one is graded (${codes.join(",")})`);

    section("6. Pre-test and post-test");
    const mkPP = async (type: "PRE_TEST" | "POST_TEST", qs: string[]) => {
      const a = (await mk(T1, { title: `${type} ${KEY}`, type, questions: qs.map((q) => ({ questionId: q })) })).json.data;
      await api("POST", `/api/teacher/assessments/${a.id}/publish`, T1);
      await api("POST", `/api/teacher/assessments/${a.id}/assign`, T1, { classroomId: C1.id });
      return a;
    };
    const PRE = await mkPP("PRE_TEST", [qMC, qNum]), POST = await mkPP("POST_TEST", [qMC, qNum]);
    const preView = (await api("GET", `/api/student/assessments/${PRE.id}`, S1.token)).json.data;
    const preAtt = (await startA(S1.token, PRE.id)).json.data.attemptId;
    const preRes = await submit(S1.token, preAtt, [{ assessmentItemId: preView.items[0].id, studentAnswer: "b" }, { assessmentItemId: preView.items[1].id, studentAnswer: "5" }]);
    assert(preRes.status === 200 && preRes.json.data.scorePercent === 50, `Pre-test graded: one of two right = 50% (${preRes.json.data?.scorePercent}%)`);
    assert(preRes.json.data.answersHidden === true && preRes.json.data.responses.length === 0, "A pre-test result hides which answers were right (no per-question results)");
    assert(!new RegExp(`EXPL-${KEY}|OK-${KEY}|NO-${KEY}|"correctAnswer"`).test(preRes.text), "...and contains no key, explanation or feedback text");
    assert((await api("GET", `/api/student/assessments/attempts/${preAtt}`, S1.token)).json.data.responses.length === 0, "Reading the pre-test result later also hides them");
    const preAgain = await startA(S1.token, PRE.id);
    assert(preAgain.status === 409, "A pre-test can be taken only once (409)");
    const half = await startA(S2.token, PRE.id);
    const preS2Items = (await api("GET", `/api/student/assessments/${PRE.id}`, S2.token)).json.data.items;
    const resumed = await startA(S2.token, PRE.id);
    assert(resumed.status === 200 && resumed.json.data.attemptId === half.json.data.attemptId, "An unfinished pre-test is resumed, not restarted");
    await submit(S2.token, half.json.data.attemptId, [{ assessmentItemId: preS2Items[0].id, studentAnswer: "b" }, { assessmentItemId: preS2Items[1].id, studentAnswer: "1" }]);
    const postView = (await api("GET", `/api/student/assessments/${POST.id}`, S1.token)).json.data;
    const postAtt = (await startA(S1.token, POST.id)).json.data.attemptId;
    await submit(S1.token, postAtt, [{ assessmentItemId: postView.items[0].id, studentAnswer: "a" }, { assessmentItemId: postView.items[1].id, studentAnswer: "5" }]);
    const cmp = await api("GET", `/api/teacher/research/comparison?preTestId=${PRE.id}&postTestId=${POST.id}&classroomId=${C1.id}`, T1);
    const pre = cmp.json.data?.preTest ?? cmp.json.data?.comparison?.preTest, post = cmp.json.data?.postTest ?? cmp.json.data?.comparison?.postTest;
    assert(cmp.status === 200 && pre?.totalStudents === 2 && post?.totalStudents === 1, `The research comparison reads these results: pre n=${pre?.totalStudents}, post n=${post?.totalStudents}`);
    const s2Pre = (await api("GET", `/api/teacher/assessments/${PRE.id}/results`, T1)).json.data.students.find((s: any) => s.name === "Student s2").scorePercent;
    assert(s2Pre === 0 && pre.averageScorePercent === 25, `...and its pre-test average equals the mean of the two graded scores (50 and ${s2Pre} -> ${pre.averageScorePercent})`);
    assert(post.averageScorePercent === 100, "...and the post-test average is 100 (student 1 answered both correctly)");
    const cmpOther = await api("GET", `/api/teacher/research/comparison?preTestId=${PRE.id}&postTestId=${POST.id}`, T2);
    const o = cmpOther.json.data?.preTest ?? cmpOther.json.data?.comparison?.preTest;
    assert(cmpOther.status === 200 && (o?.totalStudents ?? 0) === 0, "Another teacher sees none of these students in a comparison");

    section("7. Teacher results");
    const res = await api("GET", `/api/teacher/assessments/${A.id}/results`, T1);
    const R = res.json.data;
    assert(res.status === 200 && R.summary.assigned === 2 && R.summary.completed === 2 && R.summary.notStarted === 0, `Roster: 2 assigned, 2 completed (${JSON.stringify(R?.summary)})`);
    assert(R.students.map((s: any) => s.name).join() === "Student s1,Student s2", "Students are listed by name");
    assert(R.items.length === 4 && R.items.every((i: any) => i.answered >= 2), "Per-question accuracy is reported");
    const preRes2 = (await api("GET", `/api/teacher/assessments/${PRE.id}/results`, T1)).json.data;
    assert(preRes2.summary.completed === 2, "Pre-test results list both students");
    const lonely = await mkPP("POST_TEST", [qMC]);
    await api("POST", "/api/student/classes/join", S3.token, { code: code1 });
    const lonelyRes = (await api("GET", `/api/teacher/assessments/${lonely.id}/results`, T1)).json.data;
    assert(lonelyRes.summary.assigned === 3 && lonelyRes.summary.notStarted === 3 && lonelyRes.summary.meanScorePercent === null, "A student who joins later appears as 'not started'; no mean without results");
    assert((await api("GET", `/api/teacher/assessments/${A.id}/results`, T2)).status === 403, "Another teacher cannot see the results (403)");
    assert((await api("GET", `/api/teacher/assessments/${A.id}/results`, admin)).status === 200, "An admin can");
    assert((await api("GET", `/api/teacher/assessments/${A.id}/results`, S1.token)).status === 403, "A student cannot (403)");
    assert((await api("GET", "/api/teacher/assessments/nope/results", T1)).status === 404, "An unknown id -> 404");
    const list1 = (await api("GET", "/api/teacher/assessments", T1)).json.data, list2 = (await api("GET", "/api/teacher/assessments", T2)).json.data;
    assert(list1.length >= 5 && list2.length === 0, "A teacher's list holds only their own assessments");
    assert(!list1.some((x: any) => x.authorName === "Teacher Santos"), "No invented author names");

    section("7b. Archiving")
    const arc = (id: string, tok: string | undefined) => api("POST", `/api/teacher/assessments/${id}/archive`, tok);
    assert((await arc(lonely.id, T2)).status === 403 && (await arc(lonely.id, S1.token)).status === 403 && (await arc(lonely.id, undefined)).status === 403, "Only the author (or an admin) can archive: other teacher, student and signed-out are refused");
    assert((await arc("nope", T1)).status === 404, "Archiving an unknown id -> 404");
    const arced = await arc(lonely.id, T1);
    assert(arced.status === 200 && arced.json.data.status === "ARCHIVED", "The author archives it");
    assert((await arc(lonely.id, T1)).status === 200, "Archiving twice is harmless");
    assert((await api("GET", `/api/student/assessments/${lonely.id}`, S1.token)).status === 404 && !(await stuList(S1.token)).json.data.some((x: any) => x.id === lonely.id), "Students can no longer see or open it");
    assert((await api("POST", `/api/teacher/assessments/${lonely.id}/publish`, T1)).status === 409, "An archived assessment cannot be published again (409)");
    assert((await api("GET", `/api/teacher/assessments/${lonely.id}/results`, T1)).status === 200, "Its results remain available to the teacher");
    assert((await api("GET", "/api/teacher/assessments?status=ARCHIVED", T1)).json.data.some((x: any) => x.id === lonely.id), "It can be listed as archived");

    section("8. Leaving the class removes access");
    const leave = await api("DELETE", `/api/student/classes/${C1.id}`, S3.token);
    assert(leave.status === 200, "Student 3 leaves the class");
    assert((await stuList(S3.token)).json.data.length === 0 && (await startA(S3.token, A.id)).status === 404, "...and loses access at once");
    await api("PATCH", `/api/teacher/classes/${C1.id}`, T1, { archived: true });
    assert((await stuList(S1.token)).json.data.length === 0 && (await startA(S1.token, A.id)).status === 404, "Archiving the class removes access for its students");
    await api("PATCH", `/api/teacher/classes/${C1.id}`, T1, { archived: false });
    assert((await stuList(S1.token)).json.data.length >= 1, "Un-archiving restores it");
  } finally {
    await stop();
  }
  console.log(`\n======================================================\nPHASE 33 RESULTS (${DB_MODE ? "PostgreSQL" : "in-memory"}): ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log("ALL PHASE 33 ASSESSMENT CHECKS PASSED");
  process.exit(0);
}
main().catch((e) => { console.error("Phase 33 suite crashed:", e); process.exit(1); });

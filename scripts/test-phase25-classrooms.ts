/**
 * Tuklas AI - Phase 25: classroom foundation, account security, honest teacher analytics.
 *
 * Black-box over HTTP against a spawned server, so the SAME suite verifies:
 *   in-memory mode:   AI_PROVIDER=local npx tsx scripts/test-phase25-classrooms.ts
 *   PostgreSQL mode:  DATABASE_URL=postgresql://... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase25-classrooms.ts
 * (the PostgreSQL wrapper scripts/test-phase25-prisma.ts creates the admin and runs this).
 * Every account is created through the real flows: admin creates teachers, students register.
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

process.env.AI_PROVIDER = "local";
const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";

let passed = 0, failed = 0;
const failures: string[] = [];
const assert = (c: boolean, m: string) => {
  if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); }
  else { failed++; failures.push(m); console.error(`  ❌ FAILED: ${m}`); }
};
const section = (t: string) => console.log(`\n--- ${t} ---`);

const run = crypto.randomBytes(3).toString("hex");
const email = (tag: string) => `p25.${tag}.${run}@example.edu`;
const PASSWORD = "Sturdy-Pass1";

async function main() {
  const port = 3300 + Math.floor(Math.random() * 90);
  const base = `http://127.0.0.1:${port}`;
  const server: ChildProcess = spawn("npx", ["tsx", "server.ts"], {
    env: { ...process.env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(32).toString("hex") },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    let up = false;
    for (let i = 0; i < 90 && !up; i++) {
      await new Promise((r) => setTimeout(r, 500));
      try { up = (await fetch(`${base}/api/health`)).ok; } catch { /* waiting */ }
    }
    if (!up) throw new Error("server did not start");
    console.log(`Server up (${DB_MODE ? "PostgreSQL" : "in-memory"} mode)`);

    type R = { status: number; json: any; headers: Headers };
    const api = async (method: string, path: string, token?: string, body?: unknown): Promise<R> => {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return { status: res.status, json: await res.json().catch(() => ({})), headers: res.headers };
    };
    const login = async (e: string, p: string) => {
      const r = await api("POST", "/api/auth/login", undefined, { email: e, password: p });
      return r.status === 200 ? (r.json.token as string) : undefined;
    };

    // ------------------------------------------------------------------
    section("1. Account security: admin-created staff, registration, login");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    assert(!!admin, "Administrator can sign in");
    if (!admin) throw new Error("no admin token; cannot continue");

    const createUser = (tok: string | undefined, body: object) => api("POST", "/api/admin/users", tok, body);
    const t1 = await createUser(admin, { name: "Teacher One", email: email("t1"), password: PASSWORD, role: "TEACHER" });
    assert(t1.status === 201 && t1.json.data?.role === "TEACHER" && !JSON.stringify(t1.json).match(/passwordHash|\$2[aby]\$/), "Admin creates a TEACHER; response carries no password hash");
    const T1 = (await login(email("t1"), PASSWORD))!;
    assert(!!T1, "The new teacher can sign in");
    await createUser(admin, { name: "Teacher Two", email: email("t2"), password: PASSWORD, role: "TEACHER" });
    const T2 = (await login(email("t2"), PASSWORD))!;
    await createUser(admin, { name: "Teacher Three", email: email("t3"), password: PASSWORD, role: "TEACHER" });
    const T3 = (await login(email("t3"), PASSWORD))!;

    assert((await createUser(T1, { name: "X", email: email("x"), password: PASSWORD, role: "ADMIN" })).status === 403, "A teacher cannot create accounts");
    assert((await createUser(undefined, { name: "X", email: email("x"), password: PASSWORD, role: "TEACHER" })).status === 403, "Anonymous cannot create accounts");
    assert((await createUser(admin, { name: "X", email: email("x"), password: PASSWORD, role: "SUPERUSER" })).status === 400, "Unknown role rejected");
    assert((await createUser(admin, { name: "X", email: email("x"), password: "short1", role: "TEACHER" })).status === 400, "Weak admin-set password rejected");
    assert((await createUser(admin, { name: "X", email: email("x"), password: "allletters", role: "TEACHER" })).status === 400, "Password without a digit rejected");
    assert((await createUser(admin, { name: "Dup", email: email("t1"), password: PASSWORD, role: "TEACHER" })).status === 409, "Duplicate email -> 409");
    const list = await api("GET", "/api/admin/users?role=TEACHER", admin);
    assert(list.status === 200 && list.json.data.users.some((u: any) => u.email === email("t1")) && !JSON.stringify(list.json).match(/passwordHash|\$2[aby]\$/), "Admin lists users without hashes");
    assert((await api("GET", "/api/admin/users", T1)).status === 403, "Teacher cannot list users");

    // Self-registration is students only, with a real password policy
    const regTeacher = await api("POST", "/api/auth/register", undefined, { name: "Sneaky", email: email("sneak"), password: PASSWORD, role: "ADMIN" });
    assert(regTeacher.status === 201 && regTeacher.json.user.role === "STUDENT", "Registering with role=ADMIN still creates a STUDENT");
    assert((await api("POST", "/api/auth/register", undefined, { name: "W", email: email("weak"), password: "abc123", role: "STUDENT" })).status === 400, "Registration enforces the new password policy (8+ chars)");

    const regStudent = async (tag: string) => {
      const r = await api("POST", "/api/auth/register", undefined, { name: `Student ${tag}`, email: email(tag), password: PASSWORD });
      return { token: r.json.token as string, id: r.json.user?.id as string, email: email(tag) };
    };
    const [s1, s2, s3, s4] = [await regStudent("s1"), await regStudent("s2"), await regStudent("s3"), await regStudent("s4")];
    assert(!!s1.token && !!s4.token, "Four students registered");

    // Brute-force throttling (unique email so other tests are unaffected)
    const victim = email("victim");
    await api("POST", "/api/auth/register", undefined, { name: "Victim", email: victim, password: PASSWORD });
    let last: R | undefined;
    for (let i = 0; i < 8; i++) last = await api("POST", "/api/auth/login", undefined, { email: victim, password: "Wrong-pass9" });
    const blocked = await api("POST", "/api/auth/login", undefined, { email: victim, password: PASSWORD });
    assert(blocked.status === 429 && Number(blocked.headers.get("retry-after")) > 0, "After 8 failures the account is throttled (429 + Retry-After), even with the right password");
    assert((await api("POST", "/api/auth/login", undefined, { email: email("s1"), password: PASSWORD })).status === 200, "Throttling one account does not lock others");
    const unknownEmail = await api("POST", "/api/auth/login", undefined, { email: email("nobody"), password: "Whatever-1" });
    assert(unknownEmail.status === 401 && unknownEmail.json.error === "Invalid email or password", "Unknown email gets the same generic error as a wrong password");

    // Change password
    assert((await api("POST", "/api/auth/change-password", s2.token, { currentPassword: "nope", newPassword: "Another-Pass2" })).status === 401, "Change password needs the right current password");
    assert((await api("POST", "/api/auth/change-password", s2.token, { currentPassword: PASSWORD, newPassword: "weak" })).status === 400, "...and a policy-compliant new one");
    assert((await api("POST", "/api/auth/change-password", undefined, { currentPassword: PASSWORD, newPassword: "Another-Pass2" })).status === 401, "...and a session");
    assert((await api("POST", "/api/auth/change-password", s2.token, { currentPassword: PASSWORD, newPassword: "Another-Pass2" })).status === 200, "Password changed");
    assert(!(await login(s2.email, PASSWORD)) && !!(await login(s2.email, "Another-Pass2")), "Old password stops working; new one works");

    // ------------------------------------------------------------------
    section("2. Creating and listing classes");
    const mk = (tok: string | undefined, body: object) => api("POST", "/api/teacher/classes", tok, body);
    const c1 = await mk(T1, { name: "Grade 7 - Rizal", gradeLevel: 7 });
    assert(c1.status === 201 && /^[A-HJ-KM-NP-Z2-9]{6}$/.test(c1.json.data.joinCode), `Class created with a 6-character unambiguous join code (${c1.json.data?.joinCode})`);
    const C1 = c1.json.data.id as string;
    const code1 = c1.json.data.joinCode as string;
    assert((await mk(s1.token, { name: "Hack" })).status === 403, "A student cannot create a class");
    assert((await mk(undefined, { name: "Hack" })).status === 401, "Anonymous cannot create a class");
    assert((await mk(T1, { name: "x" })).status === 400, "Too-short class name rejected");
    assert((await mk(T1, { name: "Ok name", gradeLevel: 99 })).status === 400, "Grade level out of range rejected");
    const weird = await mk(T1, { name: "  Grade\u0000 7\n  -  Bonifacio  " });
    assert(weird.status === 201 && weird.json.data.name === "Grade 7 - Bonifacio", "Control characters and extra spaces are cleaned from names");
    const C1b = weird.json.data.id as string;

    const t1List = await api("GET", "/api/teacher/classes", T1);
    assert(t1List.status === 200 && t1List.json.data.some((c: any) => c.id === C1) && t1List.json.data.length >= 2, "Teacher lists their classes");
    assert(!(await api("GET", "/api/teacher/classes", T2)).json.data.some((c: any) => c.id === C1), "Another teacher does not see them");
    assert((await api("GET", "/api/teacher/classes", admin)).json.data.some((c: any) => c.id === C1), "An admin sees all classes");
    assert((await api("GET", "/api/teacher/classes", s1.token)).status === 403, "Students cannot use the teacher class list");

    // limit per teacher
    let lastStatus = 201, created = 0;
    for (let i = 0; i < 32 && lastStatus === 201; i++) {
      const r = await mk(T3, { name: `Bulk class ${i}` });
      lastStatus = r.status;
      if (r.status === 201) created++;
    }
    assert(created === 30 && lastStatus === 409, `A teacher is limited to 30 active classes (created ${created}, then ${lastStatus})`);

    // ------------------------------------------------------------------
    section("3. Ownership (IDOR): another teacher can do nothing to my class");
    const idor: Array<[string, string, string, object | undefined]> = [
      ["GET", `/api/teacher/classes/${C1}`, "detail", undefined],
      ["PATCH", `/api/teacher/classes/${C1}`, "rename", { name: "Hijacked" }],
      ["POST", `/api/teacher/classes/${C1}/join-code/regenerate`, "regenerate code", {}],
      ["POST", `/api/teacher/classes/${C1}/students`, "add students", { emails: [s1.email] }],
      ["DELETE", `/api/teacher/classes/${C1}/students/${s1.id}`, "remove student", undefined],
      ["POST", `/api/teacher/classes/${C1}/assignments`, "create assignment", { title: "x", lessonId: "lsn_01" }],
    ];
    for (const [m, p, label, body] of idor) {
      const r = await api(m, p, T2, body);
      assert(r.status === 403, `Other teacher cannot ${label} (got ${r.status})`);
    }
    assert((await api("GET", "/api/teacher/classes/does-not-exist", T1)).status === 404, "Unknown class -> 404");
    assert((await api("PATCH", `/api/teacher/classes/${C1}`, s1.token, { name: "Hijacked" })).status === 403, "A student cannot modify a class");
    assert((await api("GET", `/api/teacher/classes/${C1}`, T1)).json.data.classroom.name === "Grade 7 - Rizal", "The class was not changed by the failed attempts");

    // ------------------------------------------------------------------
    section("4. Roster: add by email, privacy of staff accounts");
    const add = await api("POST", `/api/teacher/classes/${C1}/students`, T1, { emails: [s1.email, s2.email.toUpperCase(), s1.email, "not-an-email", email("ghost"), email("t2"), ADMIN_EMAIL] });
    const byEmail = Object.fromEntries((add.json.data ?? []).map((r: any) => [r.email, r.status]));
    assert(add.status === 200 && byEmail[s1.email] === "ADDED" && byEmail[s2.email] === "ADDED", "Existing students are added (case-insensitive, duplicates collapsed)");
    assert(byEmail[email("ghost")] === "NO_STUDENT_ACCOUNT" && byEmail[email("t2")] === "NO_STUDENT_ACCOUNT" && byEmail[ADMIN_EMAIL] === "NO_STUDENT_ACCOUNT", "Unknown emails AND staff accounts both answer NO_STUDENT_ACCOUNT (no staff discovery)");
    assert(Object.values(byEmail).includes("INVALID_EMAIL"), "Invalid emails reported");
    assert((await api("POST", `/api/teacher/classes/${C1}/students`, T1, { emails: [s1.email] })).json.data[0].status === "ALREADY_ENROLLED", "Adding again is idempotent");
    assert((await api("POST", `/api/teacher/classes/${C1}/students`, T1, { emails: [] })).status === 400, "Empty list rejected");
    assert((await api("POST", `/api/teacher/classes/${C1}/students`, T1, { emails: Array.from({ length: 61 }, (_, i) => `a${i}@x.org`) })).status === 400, "More than 60 emails rejected");
    const detail = await api("GET", `/api/teacher/classes/${C1}`, T1);
    assert(detail.json.data.students.length === 2 && detail.json.data.classroom.joinCode === code1, "Class detail lists the roster and (for the owner) the join code");
    assert(!JSON.stringify(detail.json).match(/passwordHash/), "Class detail never includes password hashes");

    // ------------------------------------------------------------------
    section("5. Teacher access follows enrolment (student privacy)");
    const tryStudent = (tok: string, id: string) => api("GET", `/api/teacher/students/${id}`, tok);
    assert((await tryStudent(T1, s1.id)).status === 200, "Teacher sees an enrolled student");
    assert((await tryStudent(T2, s1.id)).status === 403, "Other teacher cannot see that student");
    assert((await tryStudent(T1, s3.id)).status === 403, "Teacher cannot see a student who is in no class of theirs");
    assert((await api("GET", `/api/teacher/students/${s1.id}/insights`, T2)).status === 403 && (await api("GET", `/api/teacher/students/${s1.id}/tutor-flags`, T2)).status === 403, "Insights and tutor flags are protected the same way");
    const roster = await api("GET", "/api/teacher/students", T1);
    assert(roster.status === 200 && roster.json.data.students.length === 2 && roster.json.data.students.every((s: any) => [s1.id, s2.id].includes(s.id)), "The teacher's student list contains only their own students");
    assert((await api("GET", `/api/teacher/students?classId=${C1}`, T2)).status === 403, "Other teacher cannot list that class's students");
    assert((await tryStudent(admin, s3.id)).status === 200, "An admin can see any student");

    // ------------------------------------------------------------------
    section("6. Joining with a code");
    const join = (tok: string | undefined, code: unknown) => api("POST", "/api/student/classes/join", tok, { code });
    const j1 = await join(s3.token, ` ${code1.toLowerCase().slice(0, 3)}-${code1.slice(3)} `);
    assert(j1.status === 200 && j1.json.data.name === "Grade 7 - Rizal" && j1.json.data.joinCode === null, "Student joins (lowercase / spaces / hyphen tolerated) and is NOT shown the code");
    assert((await join(s3.token, code1)).status === 200, "Joining twice is harmless");
    assert((await tryStudent(T1, s3.id)).status === 200, "The teacher now sees the student who joined by code");
    assert((await join(T1, code1)).status === 403 && (await join(admin, code1)).status === 403, "Staff accounts cannot 'join' a class");
    assert((await join(undefined, code1)).status === 401, "Joining requires a sign-in");
    const mine = await api("GET", "/api/student/classes", s3.token);
    assert(mine.json.data.length === 1 && mine.json.data[0].teacherName === "Teacher One" && !JSON.stringify(mine.json).includes(code1), "Student sees their class and teacher name, never the join code");
    assert((await api("GET", "/api/student/classes", s4.token)).json.data.length === 0, "A student not in the class sees nothing");

    // codes that must all fail identically
    const msgs = new Set<string>();
    for (const bad of ["ZZZZZZ", "ab", "", "0O1IL9", code1.slice(0, 5)]) {
      const r = await join(s4.token, bad);
      msgs.add(`${r.status}:${r.json.error}`);
    }
    assert(msgs.size === 1 && [...msgs][0].startsWith("404:"), "Unknown, malformed and empty codes fail identically (404, one message)");

    // switch off / regenerate / archive
    const off = await api("PATCH", `/api/teacher/classes/${C1}`, T1, { joinCodeActive: false });
    assert(off.status === 200 && off.json.data.joinCodeActive === false, "Teacher switches the code off");
    const rOff = await join(s4.token, code1);
    assert(rOff.status === 404 && msgs.has(`404:${rOff.json.error}`), "A switched-off code fails with the SAME generic message");
    await api("PATCH", `/api/teacher/classes/${C1}`, T1, { joinCodeActive: true });
    const regen = await api("POST", `/api/teacher/classes/${C1}/join-code/regenerate`, T1, {});
    const code2 = regen.json.data.joinCode as string;
    assert(regen.status === 200 && code2 !== code1, "Teacher regenerates the code");
    assert((await join(s4.token, code1)).status === 404, "The old code stops working");
    assert((await join(s4.token, code2)).status === 200, "The new code works");

    // throttle: dedicated student
    const s5 = await regStudent("s5");
    let t429 = 0;
    for (let i = 0; i < 11; i++) if ((await join(s5.token, "ZZZZZ" + "ABCDEFGH"[i % 8])).status === 429) t429++;
    assert(t429 >= 1, `Guessing codes is throttled (429 after ~10 failures; got ${t429} blocked)`);
    assert((await join(s5.token, code2)).status === 429, "...and even a correct code is refused while throttled");

    // ------------------------------------------------------------------
    section("7. Removing, leaving, archiving");
    assert((await api("DELETE", `/api/teacher/classes/${C1}/students/${s3.id}`, T1)).status === 200, "Teacher removes a student");
    assert((await tryStudent(T1, s3.id)).status === 403, "...and immediately loses access to that student");
    assert((await api("DELETE", `/api/teacher/classes/${C1}/students/${s3.id}`, T1)).status === 404, "Removing someone not in the class -> 404");
    assert((await api("GET", "/api/student/classes", s3.token)).json.data.length === 0, "The removed student no longer sees the class");
    assert((await join(s3.token, code2)).status === 200, "Student re-joins");
    assert((await api("DELETE", `/api/student/classes/${C1}`, s3.token)).status === 200, "Student leaves the class");
    assert((await tryStudent(T1, s3.id)).status === 403, "...and the teacher loses access");
    assert((await api("DELETE", `/api/student/classes/${C1}`, T1)).status === 403, "Teachers cannot use the leave endpoint");

    assert((await tryStudent(T1, s1.id)).status === 200, "Precondition: teacher sees s1");
    const arch = await api("PATCH", `/api/teacher/classes/${C1}`, T1, { archived: true });
    assert(arch.status === 200 && arch.json.data.archived === true, "Teacher archives the class");
    assert((await tryStudent(T1, s1.id)).status === 403, "Archived class: teacher no longer has access to its students");
    assert(!(await api("GET", "/api/teacher/classes", T1)).json.data.some((c: any) => c.id === C1), "Archived class disappears from the list");
    assert((await join(s4.token, code2)).status === 404, "Archived class cannot be joined");
    assert((await api("GET", "/api/student/classes", s1.token)).json.data.length === 0, "Students do not see an archived class");
    assert((await api("POST", `/api/teacher/classes/${C1}/students`, T1, { emails: [s4.email] })).status === 409, "Cannot change an archived roster");
    const restored = await api("PATCH", `/api/teacher/classes/${C1}`, T1, { archived: false });
    assert(restored.status === 200 && (await tryStudent(T1, s1.id)).status === 200, "Restoring the class restores access");

    // ------------------------------------------------------------------
    section("8. Assignments");
    // find a published lesson and a draft one through the real API
    const units = await api("GET", "/api/curriculum", T1);
    const unitId = units.json.data?.grades?.[0]?.terms?.[0]?.units?.[0]?.id ?? "unt_01";
    const mkLesson = async (title: string, publish: boolean) => {
      const l = await api("POST", "/api/lessons", T1, { title, unitId, learningObjectives: [], estimatedMinutes: 10 });
      const id = l.json.data?.id as string;
      if (publish) {
        await api("POST", `/api/lessons/${id}/blocks`, T1, { type: "TEXT", title: "Intro", content: "Integers are whole numbers.", sequenceOrder: 1 });
        for (const targetStatus of ["REVIEW", "APPROVED", "PUBLISHED"]) await api("POST", `/api/lessons/${id}/status`, admin, { targetStatus });
      }
      return id;
    };
    const pubLesson = await mkLesson(`P25 published ${run}`, true);
    const draftLesson = await mkLesson(`P25 draft ${run}`, false);
    assert(!!pubLesson && !!draftLesson, "Created a published and a draft lesson");

    const assign = (tok: string, cls: string, body: object) => api("POST", `/api/teacher/classes/${cls}/assignments`, tok, body);
    const due = new Date(Date.now() + 5 * 86400000).toISOString();
    const a1 = await assign(T1, C1, { title: "Read Lesson 1", lessonId: pubLesson, dueDate: due });
    assert(a1.status === 201 && a1.json.data.lessonId === pubLesson, "Teacher assigns a published lesson");
    assert((await assign(T1, C1, { title: "Draft", lessonId: draftLesson })).status === 409, "A DRAFT lesson cannot be assigned");
    assert((await assign(T1, C1, { title: "Ghost", lessonId: "lsn_missing" })).status === 404, "Missing lesson -> 404");
    assert((await assign(T1, C1, { title: "Ghost", practiceSetId: "ps_missing" })).status === 404, "Missing practice set -> 404");
    assert((await assign(T1, C1, { title: "Nothing" })).status === 400, "An assignment needs a lesson or practice set");
    assert((await assign(T1, C1, { title: "Bad date", lessonId: pubLesson, dueDate: "not a date" })).status === 400, "Invalid due date rejected");
    assert((await assign(T1, C1, { title: "x", lessonId: pubLesson })).status === 400, "Too-short title rejected");
    assert((await assign(s1.token, C1, { title: "Student", lessonId: pubLesson })).status === 403, "A student cannot create assignments");

    const sAssign = await api("GET", "/api/student/assignments", s1.token);
    const mineA = (sAssign.json.data ?? []).find((a: any) => a.id === a1.json.data.id);
    assert(sAssign.status === 200 && mineA?.state === "NOT_STARTED" && mineA.lessonTitle?.includes("P25 published") && mineA.classroomName === "Grade 7 - Rizal", "Enrolled student sees it with lesson title, class and NOT_STARTED state");
    // s4 joined this class earlier; s5 never joined any class.
    assert(!(await api("GET", "/api/student/assignments", s5.token)).json.data.some((a: any) => a.id === a1.json.data.id), "A student who is not in the class does NOT see it");
    assert((await api("PATCH", `/api/teacher/assignments/${a1.json.data.id}`, T2, { status: "ARCHIVED" })).status === 403, "Other teacher cannot archive it");
    assert((await api("PATCH", `/api/teacher/assignments/${a1.json.data.id}`, s1.token, { status: "ARCHIVED" })).status === 403, "A student cannot archive it");
    assert((await api("PATCH", `/api/teacher/assignments/${a1.json.data.id}`, T1, { status: "BANANA" })).status === 400, "Invalid status rejected");
    assert((await api("PATCH", `/api/teacher/assignments/${a1.json.data.id}`, T1, { status: "ARCHIVED" })).status === 200, "Owner archives the assignment");
    assert(!(await api("GET", "/api/student/assignments", s1.token)).json.data.some((a: any) => a.id === a1.json.data.id), "Archived assignments disappear for students");
    await api("PATCH", `/api/teacher/classes/${C1}`, T1, { archived: true });
    assert((await assign(T1, C1, { title: "Late", lessonId: pubLesson })).status === 409, "Cannot assign into an archived class");
    await api("PATCH", `/api/teacher/classes/${C1}`, T1, { archived: false });

    // ------------------------------------------------------------------
    section("9. Teacher analytics are honest when there is no data");
    const cNew = (await mk(T2, { name: "Fresh class" })).json.data.id as string;
    const dash0 = await api("GET", "/api/teacher/dashboard", T2);
    assert(dash0.status === 200 && dash0.json.data.stats.totalStudents === 0 && dash0.json.data.classProgress.averageClassAccuracy === null, "Empty class: zero students, accuracy is null (not an invented number)");
    await api("POST", `/api/teacher/classes/${cNew}/students`, T2, { emails: [s4.email] });
    const dash = await api("GET", "/api/teacher/dashboard", T2);
    const d = dash.json.data;
    assert(d.stats.totalStudents === 1 && d.classProgress.averageClassAccuracy === null, "Enrolled but inactive student: class accuracy stays null");
    assert(d.difficultSkills.length === 0 && d.commonMistakes.length === 0 && d.needsAttention.length === 0, "No invented 'difficult skills', mistakes or support signals without evidence");
    const roster2 = await api("GET", "/api/teacher/students", T2);
    const st = roster2.json.data.students[0];
    assert(st.overallAccuracy === null && st.status === "NO_DATA" && st.lastActivityAt === null, "Student with no activity: accuracy null, status NO_DATA (not 'ACTIVE' at 75%)");
    const ai = await api("POST", "/api/teacher/ai-assistant", T2, { prompt: "which skills are most difficult?", classId: cNew });
    const answer = JSON.stringify(ai.json.data);
    assert(ai.status === 200 && !/Adding Integers|65%|75%|Sign & Inverse|strong foundational recall|frequently confuse/i.test(answer), "Teacher AI assistant states no invented skills, percentages or classroom claims");
    assert(ai.json.data.groundedMetrics.averageClassAccuracy === "no data yet", "...and reports missing data as missing");
    assert((await api("POST", "/api/teacher/ai-assistant", T2, { prompt: "how are we doing?", classId: C1 })).status === 403, "Teacher AI assistant refuses a class the teacher does not own");
    assert((await api("POST", "/api/teacher/ai-assistant", T3, { prompt: "how are we doing?" })).json.data.answer.includes("no enrolled students"), "A teacher with empty classes is told there is nothing to analyse yet");

    console.log("\n======================================================");
    console.log(`PHASE 25 RESULTS (${DB_MODE ? "PostgreSQL" : "in-memory"}): ${passed} passed, ${failed} failed`);
    if (failed > 0) { console.log("Failures:\n - " + failures.join("\n - ")); process.exit(1); }
    console.log("ALL PHASE 25 CHECKS PASSED (see docs/PHASE_25_VERIFICATION.md for what is NOT covered).");
  } finally {
    server.kill("SIGTERM");
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("Test harness crashed:", e); process.exit(1); });

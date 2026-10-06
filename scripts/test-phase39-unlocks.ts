/**
 * Tuklas AI - Phase 39: teacher opens lessons early (class-wide / one student). Black-box over HTTP, same suite for both stores:
 *   in-memory:   AI_PROVIDER=local npx tsx scripts/test-phase39-unlocks.ts
 *   PostgreSQL:  DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase39-unlocks.ts
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p39.${t}.${run}@example.edu`;
let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);

async function main() {
  const port = 6300 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
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

    section("0. Setup");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    for (const t of ["t1", "t2"]) await api("POST", "/api/admin/users", admin, { name: `Teacher ${t}`, email: email(t), password: PASSWORD, role: "TEACHER" });
    const T1 = await login(email("t1"), PASSWORD), T2 = await login(email("t2"), PASSWORD);
    const reg = async (tag: string) => { const r = await api("POST", "/api/auth/register", undefined, { name: `Stu ${tag}`, email: email(tag), password: PASSWORD }); return { token: r.json.token as string, id: r.json.user.id as string }; };
    const s1 = await reg("s1"), s2 = await reg("s2"), s3 = await reg("s3");
    const cur = await api("GET", "/api/curriculum", T1);
    const unit = (cur.json.data?.[0]?.grades?.[0]?.terms ?? []).flatMap((t: any) => t.units)[0];
    const mkLesson = async (title: string, publish: boolean) => {
      const id = (await api("POST", "/api/lessons", T1, { title, unitId: unit.id, learningObjectives: ["x"] })).json.data?.id as string;
      if (publish) for (const st of ["REVIEW", "APPROVED", "PUBLISHED"]) await api("POST", `/api/lessons/${id}/status`, T1, { targetStatus: st });
      return id;
    };
    const A = await mkLesson(`P39 A ${run}`, true), B = await mkLesson(`P39 B ${run}`, true), C = await mkLesson(`P39 C ${run}`, true), D = await mkLesson(`P39 draft ${run}`, false);
    const cls = (await api("POST", "/api/teacher/classes", T1, { name: "P39 class", gradeLevel: 7 })).json.data;
    const add = await api("POST", `/api/teacher/classes/${cls.id}/students`, T1, { emails: [email("s1"), email("s2")] });
    assert(add.status === 200 || add.status === 201, "Class with two students created");
    const path = async (tok: string) => (await api("GET", "/api/student/learning-path", tok)).json.data;
    const node = (p: any, id: string) => p.learningPath.find((n: any) => n.lessonId === id);
    const access = async (tok: string, id: string) => (await api("GET", `/api/student/lessons/${id}/access`, tok)).json.data;
    const open = (tok: string, body: unknown, cid = cls.id) => api("POST", `/api/teacher/classes/${cid}/lesson-access`, tok, body);

    section("1. Before any opening, the course order applies");
    for (const s of [s1, s2, s3]) { const p = await path(s.token); assert(node(p, B).state === "LOCKED" && node(p, C).state === "LOCKED", "Later lessons are locked"); }
    assert((await access(s1.token, B)).allowed === false, "The access check refuses a locked lesson");
    assert((await api("GET", `/api/lessons/${B}`, s1.token)).status === 200, "(reading the lesson text is allowed; the work inside is what is gated)");
    const blocked = await api("POST", `/api/student/lessons/${B}/session`, s1.token, { currentSectionIndex: 1, completedBlockIds: [] });
    assert(blocked.status === 403, `Working inside a locked lesson is refused (${blocked.status})`);

    section("2. Opening a lesson for the whole class");
    const r1 = await open(T1, { lessonId: B, open: true });
    assert(r1.status === 200 && r1.json.data.lessons.find((l: any) => l.lessonId === B)?.openForClass === true, "The teacher opens lesson B for the class");
    for (const s of [s1, s2]) {
      const p = await path(s.token); const n = node(p, B);
      assert(n.state === "AVAILABLE" && n.openedByTeacher === true && n.lockReasons.length === 0, "Class students see B as available, marked as opened by the teacher");
      assert((await access(s.token, B)).allowed === true, "...and may work in it");
      assert(node(p, C).state === "LOCKED" && node(p, C).openedByTeacher === false, "...but C stays locked");
    }
    const ok = await api("POST", `/api/student/lessons/${B}/session`, s1.token, { currentSectionIndex: 0, completedBlockIds: [] });
    assert(ok.status === 200, `An opened lesson accepts the student's work (${ok.status})`);
    assert(node(await path(s3.token), B).state === "LOCKED", "A student who is not in the class is not affected");
    assert((await open(T1, { lessonId: B, open: true })).status === 200, "Opening twice is harmless");

    section("3. Opening for one student");
    const r2 = await open(T1, { lessonId: C, studentId: s1.id, open: true });
    assert(r2.status === 200 && r2.json.data.lessons.find((l: any) => l.lessonId === C).openForStudents.includes(s1.id) && !r2.json.data.lessons.find((l: any) => l.lessonId === C).openForClass, "C is opened for s1 only");
    assert(node(await path(s1.token), C).state === "AVAILABLE" && node(await path(s2.token), C).state === "LOCKED", "s1 can start C; s2 cannot");

    section("4. Closing never takes away work already started");
    await api("POST", "/api/student/progress", s1.token, { lessonId: B, action: "START" });
    assert((await open(T1, { lessonId: B, open: false })).status === 200, "The teacher closes B again");
    assert(node(await path(s2.token), B).state === "LOCKED", "A student who has not started B is locked out again");
    const s1B = node(await path(s1.token), B);
    assert(s1B.state === "IN_PROGRESS" && (await access(s1.token, B)).allowed === true, `A student who already started B keeps it (${s1B.state})`);

    section("5. Open through a lesson");
    const th = await open(T1, { lessonId: C, through: true });
    const acc = th.json.data.lessons;
    const upTo = acc.slice(0, acc.findIndex((l: any) => l.lessonId === C) + 1);
    assert(th.status === 200 && upTo.every((l: any) => l.openForClass), "Every lesson up to and including C is now open for the class");
    assert(acc.slice(acc.findIndex((l: any) => l.lessonId === C) + 1).every((l: any) => !l.openForClass), "Lessons after C are not");
    assert(node(await path(s2.token), C).state === "AVAILABLE", "s2 can start C now");
    const order = (await api("GET", `/api/teacher/classes/${cls.id}/lesson-access`, T1)).json.data.lessons;
    assert(order.every((l: any, i: number) => l.position === i + 1) && !order.some((l: any) => l.lessonId === D), "The list is in course order, positions 1..n, and has no draft lesson");

    section("6. Who may do this, and what is refused");
    assert((await open(undefined as any, { lessonId: B, open: true })).status === 401, "Signed out: 401");
    assert((await open(s1.token, { lessonId: B, open: true })).status === 403, "A student cannot open lessons: 403");
    assert((await api("GET", `/api/teacher/classes/${cls.id}/lesson-access`, s1.token)).status === 403, "...or read the access list: 403");
    assert((await open(T2, { lessonId: B, open: true })).status === 403, "Another teacher cannot change this class: 403");
    assert((await api("GET", `/api/teacher/classes/${cls.id}/lesson-access`, T2)).status === 403, "...or read it: 403");
    assert((await open(admin, { lessonId: B, open: true })).status === 200, "An administrator can");
    assert((await open(T1, { lessonId: D, open: true })).status === 409, "A draft lesson cannot be opened: 409");
    assert((await open(T1, { lessonId: "no-such-lesson", open: true })).status === 404, "An unknown lesson: 404");
    assert((await open(T1, { open: true })).status === 400 && (await open(T1, { lessonId: 5, open: true })).status === 400, "A missing or non-text lesson: 400");
    assert((await open(T1, { lessonId: B, open: "yes" })).status === 400 && (await open(T1, { lessonId: B })).status === 400, "open must be true or false: 400");
    assert((await open(T1, { lessonId: B, studentId: s3.id, open: true })).status === 404, "A student who is not in the class: 404");
    assert((await open(T1, { lessonId: B, studentId: { a: 1 }, open: true })).status === 400, "A non-text student id: 400");
    assert((await open(T1, { lessonId: "no-such-lesson", through: true })).status === 404, "Open-through an unknown lesson: 404");
    assert((await open(T1, { lessonId: B, open: true }, "no-such-class")).status === 404, "An unknown class: 404");

    section("7. An opening only counts while the student is in an active class");
    await open(T1, { lessonId: B, open: true });
    assert(node(await path(s2.token), B).state === "AVAILABLE", "(setup) s2 can start B");
    await api("DELETE", `/api/teacher/classes/${cls.id}/students/${s2.id}`, T1);
    assert(node(await path(s2.token), B).state === "LOCKED" && node(await path(s2.token), C).state === "LOCKED", "A student removed from the class loses the openings");
    await api("PATCH", `/api/teacher/classes/${cls.id}`, T1, { archived: true });
    assert(node(await path(s1.token), C).state !== "AVAILABLE" || node(await path(s1.token), C).openedByTeacher === false, "An archived class's openings stop applying");
    assert((await open(T1, { lessonId: B, open: true })).status === 409, "An archived class cannot be changed: 409");
    const second = (await api("POST", "/api/teacher/classes", T1, { name: "P39 second", gradeLevel: 7 })).json.data;
    assert(!(await api("GET", `/api/teacher/classes/${second.id}/lesson-access`, T1)).json.data.lessons.some((l: any) => l.openForClass), "Openings belong to one class: a second class starts with none");
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGTERM"); } catch { /* */ } }
  }
  console.log(`\nPHASE 39 RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

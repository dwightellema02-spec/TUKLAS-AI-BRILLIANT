/**
 * Tuklas AI - Phase 51: only Mathematics teachers verified by an administrator may create, import, edit, publish and add videos to
 * Mathematics lessons (Grades 7 to 10). Real HTTP requests against a real server.
 *   in-memory:   AI_PROVIDER=local npx tsx scripts/test-phase51-subject-authorization.ts
 *   PostgreSQL:  DATABASE_URL=... ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/test-phase51-subject-authorization.ts
 */
import crypto from "crypto";
import { spawn, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";

const DB_MODE = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@tuklas.ai";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Tuklas2026!";
const PASSWORD = "Sturdy-Pass1";
const run = crypto.randomBytes(3).toString("hex");
const email = (t: string) => `p51.${t}.${run}@example.edu`;

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => {
  if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); }
};
const section = (t: string) => console.log(`\n--- ${t} ---`);

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
  const upload = async (token: string | undefined, path: string, name: string, text: string) => {
    const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/octet-stream", "x-file-name": encodeURIComponent(name), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: new TextEncoder().encode(text) });
    return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
  };
  const login = async (e: string, p: string) => (await api("POST", "/api/auth/login", undefined, { email: e, password: p })).json.token as string;
  const mkUser = async (admin: string, tag: string, role: "TEACHER" | "ADMIN") => {
    const r = await api("POST", "/api/admin/users", admin, { name: `P51 ${tag}`, email: email(tag), password: PASSWORD, role });
    return { id: r.json.data?.id as string, token: await login(email(tag), PASSWORD) };
  };

  try {
    await start();
    console.log(`\nServer up (${DB_MODE ? "PostgreSQL" : "in-memory"} mode)`);

    section("1. Setup: admin, three teachers (none authorized yet), a student");
    const admin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const math1 = await mkUser(admin, "math1", "TEACHER");
    const math2 = await mkUser(admin, "math2", "TEACHER");
    const other = await mkUser(admin, "other", "TEACHER"); // a teacher of another subject: never assigned
    const admin2 = await mkUser(admin, "admin2", "ADMIN");
    const stu = (await api("POST", "/api/auth/register", undefined, { name: "P51 Student", email: email("stu"), password: PASSWORD })).json;
    const S = stu.token as string;
    assert(!!math1.id && !!math2.id && !!other.id && !!admin2.id && !!S, "accounts created");
    const unit = (await api("GET", "/api/curriculum", math1.token)).json.data?.[0]?.grades?.[0]?.terms?.[0]?.units?.[0];
    assert(!!unit?.id, "a Mathematics unit exists to write into");
    const seeded = (((await api("GET", `/api/lessons?unitId=${unit.id}`, admin)).json.data ?? []) as any[]).find((l) => !l.authorId);

    section("2. Before any assignment nobody can author (deny by default)");
    const body = { title: `P51 lesson ${run}`, unitId: unit.id, learningObjectives: ["x"] };
    for (const [label, t] of [["generic TEACHER math1", math1.token], ["generic TEACHER other", other.token], ["ADMIN (bootstrap)", admin], ["ADMIN admin2", admin2.token]] as const) {
      const r = await api("POST", "/api/lessons", t, body);
      assert(r.status === 403 && r.json.code === "SUBJECT_AUTHORIZATION_REQUIRED" && /Mathematics authorization required/.test(r.json.error ?? ""), `${label}: create lesson -> 403 with a clear message`);
    }
    const me0 = await api("GET", "/api/me/subject-authorization", math1.token);
    assert(me0.status === 200 && me0.json.data.canAuthorMathematics === false && !!me0.json.data.message, "the teacher can ask why: canAuthorMathematics=false plus the message");

    section("3. Only an administrator can verify; verification has rules");
    assert((await api("POST", `/api/admin/users/${math1.id}/subject-authorization`, math2.token, { subjectCode: "MATH" })).status === 403, "a teacher cannot verify anyone (not even themselves)");
    assert((await api("POST", `/api/admin/users/${math1.id}/subject-authorization`, S, { subjectCode: "MATH" })).status === 403, "a student cannot verify anyone");
    assert((await api("POST", `/api/admin/users/${math1.id}/subject-authorization`, undefined, { subjectCode: "MATH" })).status === 403, "signed out cannot verify");
    assert((await api("POST", `/api/admin/users/${math1.id}/subject-authorization`, admin, { subjectCode: "math; DROP" })).status === 400, "a malformed subject code -> 400");
    assert((await api("POST", `/api/admin/users/${stu.user.id}/subject-authorization`, admin, { subjectCode: "MATH" })).status === 409, "a student account cannot be authorized to write lessons");
    const bootstrapId = (await api("GET", "/api/auth/me", admin)).json.user?.id ?? (await api("GET", "/api/auth/me", admin)).json.data?.id;
    if (bootstrapId) assert((await api("POST", `/api/admin/users/${bootstrapId}/subject-authorization`, admin, { subjectCode: "MATH" })).status === 409, "an administrator cannot verify their own account");
    assert((await api("POST", `/api/admin/users/${math1.id}/subject-authorization`, admin, { subjectCode: "MATH", note: "Mathematics teacher, verified by the school head" })).status === 201, "admin verifies math1");
    assert((await api("POST", `/api/admin/users/${math2.id}/subject-authorization`, admin, { subjectCode: "MATH" })).status === 201, "admin verifies math2");
    assert((await api("POST", `/api/admin/users/${admin2.id}/subject-authorization`, admin, { subjectCode: "MATH" })).status === 201, "one administrator verifies another");
    const list = (await api("GET", "/api/admin/subject-authorizations", admin)).json.data as any[];
    assert(list.some((a) => a.userId === math1.id) && !list.some((a) => a.userId === other.id), "the list shows verified teachers only");
    assert((await api("GET", "/api/admin/subject-authorizations", math1.token)).status === 403, "the list is for administrators only");

    section("4. An authorized Mathematics teacher can do the whole workflow");
    const c = await api("POST", "/api/lessons", math1.token, body);
    const L = c.json.data?.id as string;
    assert(c.status === 201 && !!L, "creates a Mathematics lesson draft");
    assert((await api("PUT", `/api/lessons/${L}`, math1.token, { title: `P51 lesson ${run} (edited)` })).status === 200, "edits it");
    assert((await api("POST", `/api/lessons/${L}/blocks`, math1.token, { type: "TEXT", title: "Intro", content: "Read this" })).status === 201, "adds a block");
    assert((await api("POST", `/api/lessons/${L}/notes`, math1.token, { title: "Note", notes: "A teacher note for the tutor." })).status < 300, "adds a teacher note");
    const up = await upload(math1.token, `/api/lessons/${L}/documents`, "notes.txt", "Fractions are parts of a whole. A half is one of two equal parts.");
    assert(up.status === 201 || up.status === 200, `uploads a document to it (got ${up.status})`);
    const imp = await upload(math1.token, `/api/teacher/lessons/import?unitId=${unit.id}`, "draft.txt", "Lesson: Adding integers\nObjectives:\n- Add integers with the same sign\n\nAdding integers\nWhen both numbers are positive the sum is positive.");
    assert(imp.status === 201 && !!imp.json.data?.lessonId, `imports a lesson draft from a document (got ${imp.status})`);
    const vid = await api("POST", `/api/lessons/${L}/video`, math1.token, { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Test video" });
    console.log(`  (info) video attach by an authorized teacher returned ${vid.status}${vid.status >= 400 ? ": " + (vid.json.error ?? "") : ""}`);
    assert(vid.status !== 403 && vid.status !== 401, `attaches a YouTube link: not refused for authorization (got ${vid.status})`);
    for (const st of ["REVIEW", "APPROVED", "PUBLISHED"]) assert((await api("POST", `/api/lessons/${L}/status`, math1.token, { targetStatus: st })).status === 200, `moves the lesson to ${st}`);
    assert((await api("POST", `/api/lessons/${L}/status`, math1.token, { targetStatus: "ARCHIVED" })).status === 200, "unpublishes (archives) it");
    assert((await api("POST", `/api/lessons/${L}/status`, math1.token, { targetStatus: "PUBLISHED" })).status !== 403, "re-publishes: not refused for authorization");
    const L2 = (await api("POST", "/api/lessons", math1.token, { ...body, title: `P51 second ${run}` })).json.data?.id as string;
    for (const st of ["REVIEW", "APPROVED"]) await api("POST", `/api/lessons/${L2}/status`, math1.token, { targetStatus: st });
    assert((await api("POST", `/api/teacher/lessons/${L2}/publish`, math1.token)).status === 200, "publishes through the teacher publish route");
    assert((await api("POST", "/api/lessons", admin2.token, { ...body, title: `P51 admin ${run}` })).status === 201, "an ADMIN who is also verified can create");

    section("5. A teacher of another subject is refused everywhere (direct API calls)");
    const snap = async () => JSON.stringify(((await api("GET", `/api/lessons/${L}`, math1.token)).json.data ?? {}).contentBlocks?.map((b: any) => [b.id, b.title, b.content]) ?? []) + ((await api("GET", `/api/lessons?unitId=${unit.id}`, math1.token)).json.data ?? []).length;
    const before = await snap();
    const denied = async (label: string, p: Promise<{ status: number; json?: any }>) => {
      const r = await p;
      assert(r.status === 403, `other-subject teacher: ${label} -> 403 (got ${r.status})`);
    };
    await denied("create a lesson", api("POST", "/api/lessons", other.token, body));
    await denied("create with forged subject/role/isMathTeacher fields", api("POST", "/api/lessons", other.token, { ...body, subject: "Mathematics", subjectCode: "MATH", role: "ADMIN", isMathTeacher: true, gradeLevel: 7 }));
    await denied("create with an unknown unit id", api("POST", "/api/lessons", other.token, { ...body, unitId: "does-not-exist" }));
    await denied("create through a differently-cased path", api("POST", "/API/Lessons", other.token, body));
    await denied("edit a Mathematics lesson", api("PUT", `/api/lessons/${L}`, other.token, { title: "hijacked" }));
    await denied("add a block", api("POST", `/api/lessons/${L}/blocks`, other.token, { type: "TEXT", title: "Evil", content: "x" }));
    await denied("reorder blocks", api("POST", `/api/lessons/${L}/reorder-blocks`, other.token, { orderedBlockIds: [] }));
    await denied("add a note", api("POST", `/api/lessons/${L}/notes`, other.token, { title: "n", notes: "x" }));
    await denied("upload a document", upload(other.token, `/api/lessons/${L}/documents`, "x.txt", "text"));
    await denied("import a document into a Mathematics unit", upload(other.token, `/api/teacher/lessons/import?unitId=${unit.id}`, "draft.txt", "Lesson: X\nsome text here"));
    await denied("attach a YouTube link", api("POST", `/api/lessons/${L}/video`, other.token, { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }));
    await denied("replace/remove a video link", api("DELETE", `/api/lessons/${L}/video/anything`, other.token));
    await denied("send a video link through the generic resource route", api("DELETE", `/api/lessons/${L}/resources/anything`, other.token));
    await denied("generate questions", api("POST", `/api/lessons/${L}/resources/anything/generate-questions`, other.token, {}));
    await denied("change lesson status", api("POST", `/api/lessons/${L}/status`, other.token, { targetStatus: "ARCHIVED" }));
    await denied("publish via the teacher publish route", api("POST", `/api/teacher/lessons/${L}/publish`, other.token));
    await denied("delete the lesson", api("DELETE", `/api/lessons/${L}`, other.token));
    await denied("reorder lessons in the unit", api("POST", `/api/units/${unit.id}/reorder-lessons`, other.token, { orderedLessonIds: [L] }));
    await denied("attach a new question to the lesson", api("POST", "/api/questions", other.token, { type: "MULTIPLE_CHOICE", prompt: "x", lessonId: L, questionData: {} }));
    await denied("attach a new practice set to the lesson", api("POST", "/api/practice-sets", other.token, { title: "x", lessonId: L }));
    if (seeded) {
      await denied("edit a seeded Mathematics lesson (no author)", api("PUT", `/api/lessons/${seeded.id}`, other.token, { title: "hijacked" }));
      await denied("publish a seeded Mathematics lesson", api("POST", `/api/lessons/${seeded.id}/status`, other.token, { targetStatus: "ARCHIVED" }));
    }
    assert(await snap() === before, "none of those attempts changed anything");
    const audit = (await api("GET", "/api/admin/audit?action=lesson.authoring_denied&limit=200", admin)).json.data;
    assert(JSON.stringify(audit).includes("lesson.authoring_denied"), "refusals are written to the audit log");

    section("6. Ownership between two authorized Mathematics teachers is preserved");
    assert((await api("PUT", `/api/lessons/${L}`, math2.token, { title: "taking over" })).status === 403, "math2 cannot edit math1's lesson");
    assert((await api("POST", `/api/lessons/${L}/video`, math2.token, { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })).status === 403, "math2 cannot attach a video to math1's lesson");
    assert((await api("POST", `/api/teacher/lessons/${L}/publish`, math2.token)).status === 403, "math2 cannot publish math1's lesson");
    if (seeded) assert((await api("PUT", `/api/lessons/${seeded.id}`, math2.token, { title: seeded.title })).status === 200, "an authorized teacher CAN manage a seeded lesson that has no author");

    section("7. Revocation is immediate; re-verification restores it");
    assert((await api("POST", `/api/admin/users/${math1.id}/subject-authorization/revoke`, math2.token, { subjectCode: "MATH" })).status === 403, "a teacher cannot revoke");
    assert((await api("POST", `/api/admin/users/${math1.id}/subject-authorization/revoke`, admin, { subjectCode: "MATH" })).status === 200, "admin revokes math1");
    assert((await api("PUT", `/api/lessons/${L}`, math1.token, { title: "after revoke" })).status === 403, "math1 is refused at once, with the same token");
    assert((await api("POST", `/api/admin/users/${math1.id}/subject-authorization/revoke`, admin, { subjectCode: "MATH" })).status === 404, "revoking twice -> 404");
    assert((await api("POST", `/api/admin/users/${math1.id}/subject-authorization`, admin, { subjectCode: "MATH" })).status === 201, "admin verifies math1 again");
    assert((await api("PUT", `/api/lessons/${L}`, math1.token, { title: `P51 lesson ${run} (restored)` })).status === 200, "math1 can edit again");

    section("8. Students and signed-out callers");
    const pub = await api("GET", `/api/lessons/${L2}`, S);
    assert(pub.status === 200 && pub.json.data?.id === L2, "a student still reads a published lesson");
    assert((await api("POST", `/api/lessons/${L2}/video`, math1.token, { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", title: "Video on the published lesson" })).status === 201, "the author attaches a video to the published lesson");
    const view = await api("GET", `/api/lessons/${L2}`, S);
    const vres = (view.json.data?.resources ?? []) as any[];
    assert(view.status === 200 && view.json.data?.status === "PUBLISHED" && vres.some((r) => /VIDEO|YOUTUBE/i.test(String(r.type))), `a student sees the approved video on the published lesson (status ${view.status}, ${vres.length} resource(s))`);
    assert(vres.every((r) => !("addedBy" in r) && !("storagePath" in r)), "...without internal fields (uploader id, storage path)");
    for (const [label, r] of [
      ["create", await api("POST", "/api/lessons", S, body)], ["edit", await api("PUT", `/api/lessons/${L2}`, S, { title: "x" })],
      ["video", await api("POST", `/api/lessons/${L2}/video`, S, { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" })],
      ["publish", await api("POST", `/api/teacher/lessons/${L2}/publish`, S)],
    ] as const) assert(r.status === 403, `student: ${label} -> 403`);
    assert((await api("POST", "/api/lessons", undefined, body)).status === 403, "signed out: create -> 403");
    const meT = await api("GET", "/api/me/subject-authorization", math1.token);
    assert(meT.json.data.canAuthorMathematics === true && meT.json.data.message === null, "an authorized teacher is told so");
    assert((await api("GET", "/api/me/subject-authorization", S)).json.data.canAuthorMathematics === false, "a student is never authorized");

    section("9. Other features still work");
    assert((await api("GET", "/api/curriculum", other.token)).status === 200, "an other-subject teacher can still read the curriculum");
    assert((await api("GET", "/api/lessons", other.token)).status === 200, "...and list lessons");
    assert((await api("POST", "/api/auth/login", undefined, { email: email("other"), password: PASSWORD })).status === 200, "sign-in is unchanged");

    if (DB_MODE) {
      section("10. PostgreSQL: one Mathematics assignment covers Grades 7, 8, 9 and 10 (and nothing outside them)");
      const db = new PrismaClient();
      try {
        const subject = await db.subject.findUniqueOrThrow({ where: { code: "MATH" } });
        const unitFor = async (level: number) => {
          const grade = await db.grade.upsert({ where: { subjectId_level: { subjectId: subject.id, level } }, update: {}, create: { subjectId: subject.id, level, name: `Grade ${level}` } });
          const term = await db.term.upsert({ where: { gradeId_termNumber: { gradeId: grade.id, termNumber: 1 } }, update: {}, create: { gradeId: grade.id, termNumber: 1, name: "Term 1" } });
          return (await db.unit.create({ data: { termId: term.id, sequenceOrder: 900 + level, title: `P51 test unit G${level} ${run}` } })).id;
        };
        for (const level of [7, 8, 9, 10]) {
          const unitId = await unitFor(level);
          const ok = await api("POST", "/api/lessons", math2.token, { title: `P51 G${level} ${run}`, unitId, learningObjectives: ["x"] });
          assert(ok.status === 201, `an authorized Mathematics teacher creates a Grade ${level} lesson`);
          assert((await api("POST", "/api/lessons", other.token, { title: `P51 x G${level}`, unitId, learningObjectives: ["x"] })).status === 403, `a teacher of another subject cannot create a Grade ${level} lesson`);
          const imp8 = await upload(math2.token, `/api/teacher/lessons/import?unitId=${unitId}`, "draft.txt", "Lesson: Grade test\nSome lesson text for the grade test here.");
          assert(imp8.status === 201, `an authorized teacher imports a draft into Grade ${level}`);
          assert((await upload(other.token, `/api/teacher/lessons/import?unitId=${unitId}`, "draft.txt", "Lesson: Grade test\nSome lesson text.")).status === 403, `...and the other-subject teacher cannot (Grade ${level})`);
        }
        const outside = await unitFor(6);
        assert((await api("POST", "/api/lessons", math2.token, { title: `P51 G6 ${run}`, unitId: outside, learningObjectives: ["x"] })).status === 403, "a Mathematics unit outside Grades 7 to 10 is refused even for an authorized teacher");
        const rows = await db.teacherSubjectAssignment.findMany({ where: { userId: { in: [math1.id, math2.id, other.id] } } });
        assert(rows.length === 2 && rows.every((r) => r.verifiedById.length > 0), "the database holds exactly one assignment per verified teacher and none for the other-subject teacher");
        assert(rows.find((r) => r.userId === math1.id)?.revokedAt === null, "math1's re-verified assignment is current (revokedAt cleared)");
      } finally { await db.$disconnect(); }
    }
  } finally {
    await stop();
  }
  console.log(`\nPhase 51 subject authorization: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

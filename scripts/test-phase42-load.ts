/**
 * Tuklas AI - Phase 42: a whole class on one school network. Needs DATABASE_URL (PostgreSQL, CREATE DATABASE allowed).
 * 45 students (default; STUDENTS=n) all appear to come from ONE address (a school's shared Wi-Fi), the server runs in PRODUCTION mode with its
 * real rate limits, and each student does what a student does in a lesson: register, join the class, read Week 1 section by section (saving
 * progress each time), answer the checkpoints, complete the lesson, do a 12-question practice set, ask the tutor, while the teacher watches
 * the dashboard. Measures every request.
 */
import crypto from "crypto";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";
import { GRADE7_TERM1_LESSONS, GRADE7_TERM1_QUESTIONS } from "../src/lib/curriculum/grade7-term1";

const N = Number(process.env.STUDENTS ?? 45);
// PACE=class (default): students read and think at a classroom pace (a few seconds per step); PACE=fast: about 6x faster, a burst far harsher than a real class
const PACE_SCALE = process.env.PACE === "fast" ? 1 : 6;

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
  const run = crypto.randomBytes(3).toString("hex");
  const adminUrl = new URL(url); adminUrl.pathname = "/postgres";
  const dbName = `tuklas_p42l_${run}`; const u = new URL(url); u.pathname = `/${dbName}`;
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  const env = { ...process.env, NODE_ENV: "production", DATABASE_URL: u.toString() } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) => spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
  let server: ChildProcess | undefined;
  const lat: Array<{ ms: number; status: number; label: string }> = [];
  const db = new PrismaClient({ datasources: { db: { url: u.toString() } } });
  try {
    sh("npx", ["tsx", "scripts/db-migrate.ts"]);
    sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" });
    const adminEmail = `p42l.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
    sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "Load Admin", ADMIN_PASSWORD: adminPassword });
    const port = 6900 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
    // production mode with its real defaults (rate limit included); TRUST_PROXY unset: every client is 127.0.0.1, i.e. one shared address
    server = spawn("node", ["--import", "tsx", "server.ts"], { env: { ...env, PORT: String(port), AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(24).toString("hex") }, stdio: "ignore", detached: true });
    for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    const call = async (label: string, method: string, p: string, token?: string, body?: unknown) => {
      const t0 = performance.now();
      let status = 0, json: any = {};
      try {
        const r = await fetch(base + p, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}`, "X-Forwarded-Proto": "https" } : { "X-Forwarded-Proto": "https" }) }, body: body !== undefined ? JSON.stringify(body) : undefined });
        status = r.status; json = await r.json().catch(() => ({}));
      } catch { status = -1; }
      lat.push({ ms: performance.now() - t0, status, label });
      return { status, json };
    };
    const think = (a = 300, b = 1500) => new Promise((r) => setTimeout(r, PACE_SCALE * (a + Math.random() * (b - a))));

    const admin = (await call("login", "POST", "/api/auth/login", undefined, { email: adminEmail, password: adminPassword })).json.token as string;
    await call("accept", "POST", "/api/auth/accept-privacy", admin); // production asks every account to accept the privacy notice first (Phase 43)
    await call("admin", "POST", "/api/admin/users", admin, { name: "Teacher", email: `p42l.t.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER", verifyMathematics: true });
    const T = (await call("login", "POST", "/api/auth/login", undefined, { email: `p42l.t.${run}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    await call("accept", "POST", "/api/auth/accept-privacy", T);
    const cls = (await call("teacher", "POST", "/api/teacher/classes", T, { name: "Load class", gradeLevel: 7 })).json.data;
    const joinCode = (await call("teacher", "GET", `/api/teacher/classes/${cls.id}`, T)).json.data.classroom?.joinCode ?? cls.joinCode;
    if (!T || !cls?.id) { console.error("setup failed:", JSON.stringify(lat.slice(0, 8))); throw new Error("setup failed"); }
    const w1 = GRADE7_TERM1_LESSONS[0];
    const lessonsRes = await call("lessons", "GET", "/api/lessons", T);
    if (!Array.isArray(lessonsRes.json.data)) throw new Error(`lessons: ${lessonsRes.status} ${JSON.stringify(lessonsRes.json).slice(0, 200)}`);
    const lessonId = (lessonsRes.json.data as any[]).find((l) => l.title === w1.title).id as string;
    const cps = w1.blocks.filter((b) => b.type === "CHECKPOINT").map((b) => b.metadata as any);
    const setId = ((await call("sets", "GET", "/api/practice-sets", T)).json.data as any[]).find((s) => s.title === `Practice: ${w1.title}`).id as string;
    const bank = new Map(GRADE7_TERM1_QUESTIONS.map((q) => [q.prompt, q]));

    console.log(`--- ${N} students on one address, production mode ---`);
    let teacherStop = false;
    const teacherLoop = (async () => { while (!teacherStop) { await call("dashboard", "GET", "/api/teacher/dashboard", T); await call("dashboard", "GET", `/api/teacher/classes/${cls.id}`, T); await think(2000, 3500); } })();
    const t0 = performance.now();
    const studentRun = async (i: number) => {
      const reg = await call("register", "POST", "/api/auth/register", undefined, { name: `Load Student ${i}`, email: `p42l.s${i}.${run}@example.edu`, password: "Sturdy-Pass1", acceptPrivacy: true });
      const S = reg.json.token as string; if (!S) return false;
      await call("join", "POST", "/api/student/classes/join", S, { code: joinCode });
      await call("path", "GET", "/api/student/learning-path", S);
      const lesson = (await call("lesson", "GET", `/api/lessons/${lessonId}`, S)).json.data;
      await call("session", "GET", `/api/student/lessons/${lessonId}/session`, S);
      const blocks = lesson?.contentBlocks ?? [];
      const done: string[] = [];
      for (let s = 0; s < blocks.length; s++) {
        await think();
        const b = blocks[s];
        if (b.type === "CHECKPOINT") {
          const want = cps.find((c: any) => b.content?.includes(c.question) || b.title === w1.blocks.find((x) => x.metadata === c)?.title) ?? cps[0];
          await call("checkpoint", "POST", `/api/student/lessons/${lessonId}/checkpoint`, S, { blockId: b.id, answer: want.options[0] });
          await call("checkpoint", "POST", `/api/student/lessons/${lessonId}/checkpoint`, S, { blockId: b.id, answer: want.correctAnswer });
        }
        done.push(b.id);
        await call("sync", "POST", `/api/student/lessons/${lessonId}/session`, S, { currentSectionIndex: s, completedBlockIds: done });
      }
      await call("complete", "POST", "/api/student/progress", S, { lessonId, action: "COMPLETE", completedBlockIndex: blocks.length, totalBlocks: blocks.length });
      const started = await call("practice", "POST", "/api/practice/start", S, { practiceSetId: setId });
      const st = started.json.data;
      if (!st?.id) { console.error(`    student ${i}: practice start ${started.status} ${JSON.stringify(started.json).slice(0, 120)}`); return false; }
      for (const x of st?.questions ?? []) {
        const q = bank.get((x.question ?? x).prompt);
        await think(200, 900);
        const ans = q?.type === "MULTIPLE_CHOICE" ? ((x.question ?? x).questionData?.choices ?? []).find((c: any) => c.text === q.choices[q.correctIndex])?.id : (q as any)?.answer;
        await call("answer", "POST", `/api/practice/${st.id}/answer`, S, { questionId: (x.question ?? x).id ?? x.questionId, answer: ans ?? "1" });
      }
      await call("practice", "POST", `/api/practice/${st.id}/complete`, S);
      for (const text of ["I need a hint", "Can you show me an example?"]) { await think(); await call("tutor", "POST", "/api/ai/tutor", S, { practiceSessionId: st.id, questionId: (st.questions?.[0]?.question ?? st.questions?.[0])?.id, studentQuery: text, helpLevel: 1 }); }
      await call("mastery", "GET", "/api/student/mastery", S);
      return true;
    };
    const ok = await Promise.all(Array.from({ length: N }, (_, i) => studentRun(i)));
    teacherStop = true; await teacherLoop;
    const secs = (performance.now() - t0) / 1000;

    const sorted = [...lat].sort((a, b) => a.ms - b.ms);
    const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].ms;
    const by = (f: (x: typeof lat[number]) => boolean) => lat.filter(f).length;
    const perMin = Math.round(lat.length / (secs / 60));
    console.log(`    ${lat.length} requests in ${secs.toFixed(0)}s (${perMin}/min from one address); latency p50 ${pct(0.5).toFixed(0)}ms, p95 ${pct(0.95).toFixed(0)}ms, p99 ${pct(0.99).toFixed(0)}ms, max ${sorted[sorted.length - 1].ms.toFixed(0)}ms`);
    const slowest = Object.entries(lat.reduce((m, x) => { (m[x.label] ??= []).push(x.ms); return m; }, {} as Record<string, number[]>)).map(([k, v]) => [k, v.sort((a, b) => a - b)[Math.floor(v.length * 0.95)] ?? 0] as const).sort((a, b) => b[1] - a[1]).slice(0, 4);
    console.log(`    slowest p95 by kind: ${slowest.map(([k, v]) => `${k} ${v.toFixed(0)}ms`).join(", ")}`);
    const odd = lat.filter((x) => x.status >= 400 || x.status < 0).reduce((m, x) => { const k = `${x.label}:${x.status}`; m[k] = (m[k] ?? 0) + 1; return m; }, {} as Record<string, number>);
    console.log(`    non-2xx by kind:status: ${JSON.stringify(odd)}`);
    const throttled = lat.filter((x) => x.status === 429);
    if (throttled.length) console.error(`    429s by kind: ${JSON.stringify(throttled.reduce((m, x) => ({ ...m, [x.label]: (m as any)[x.label] + 1 || 1 }), {}))}`);
    assert(ok.every(Boolean), `All ${N} students got through registration`);
    assert(by((x) => x.status === 429) === 0, `No request was refused as "too many" (${by((x) => x.status === 429)} of ${lat.length}); ${perMin} requests/min from the one address`);
    assert(by((x) => x.status >= 500 || x.status === -1) === 0, `No server errors or dropped requests (${by((x) => x.status >= 500 || x.status === -1)})`);
    assert(pct(0.95) < 1500, `95% of requests answered within 1.5 s (p95 ${pct(0.95).toFixed(0)} ms)`);
    const completed = await db.studentProgress.count({ where: { status: "COMPLETED", lessonId } });
    assert(completed === N, `Every student's lesson completion was recorded (${completed}/${N})`);
    const answers = await db.questionAttempt.count();
    assert(answers >= N * 10, `Practice answers were all stored (${answers})`);
    const dup = await db.$queryRawUnsafe<Array<{ n: bigint }>>('SELECT count(*)::bigint AS n FROM (SELECT 1 FROM "StudentProgress" GROUP BY "userId","skillId" HAVING count(*) > 1) d');
    assert(Number(dup[0].n) === 0, "No duplicate progress rows from simultaneous saves");
    const enr = await db.classroomEnrollment.count({ where: { classroomId: cls.id } });
    assert(enr === N, `All ${N} are enrolled in the class (${enr})`);
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGKILL"); } catch { /* */ } }
    await db.$disconnect();
    await root.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`).catch(() => {});
    await root.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 42 LOAD RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

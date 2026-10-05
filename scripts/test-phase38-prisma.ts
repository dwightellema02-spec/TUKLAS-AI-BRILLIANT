/**
 * Tuklas AI - Phase 38 on PostgreSQL. Creates a brand-new database, seeds ONLY the curriculum (production path) twice,
 * checks the rows and idempotency, then uses the real HTTP API as a student: open each lesson, answer checkpoints,
 * run every practice set to completion, and read the lessons as a teacher. Needs DATABASE_URL (PostgreSQL, CREATE DATABASE allowed).
 */
import crypto from "crypto";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";
import { GRADE7_TERM1_LESSONS, GRADE7_TERM1_QUESTIONS, GRADE7_TERM1_SKILLS } from "../src/lib/curriculum/grade7-term1";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
  const run = crypto.randomBytes(3).toString("hex");
  const dbName = `tuklas_p38_${run}`;
  const u = new URL(url); const adminUrl = new URL(url); adminUrl.pathname = "/postgres"; u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`); await root.$disconnect();
  const env = { ...process.env, DATABASE_URL: freshUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) => spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
  let server: ChildProcess | undefined;
  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  try {
    console.log("--- A. Seeding an empty database ---");
    assert(sh("npx", ["prisma", "db", "push", "--skip-generate"]).status === 0, "Schema applied");
    const seed = sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" });
    assert(seed.status === 0, `Curriculum-only seed runs in production mode${seed.status === 0 ? "" : ": " + (seed.stderr || seed.stdout).slice(-400)}`);
    const counts = async () => ({
      units: await db.unit.count(), comps: await db.competency.count(), skills: await db.skill.count(), prereq: await db.skillPrerequisite.count(),
      lessons: await db.lesson.count(), blocks: await db.lessonContentBlock.count(), ls: await db.lessonSkill.count(), q: await db.question.count(),
      sets: await db.practiceSet.count(), psq: await db.practiceSetQuestion.count(), res: await db.lessonResource.count(), users: await db.user.count(),
    });
    const c1 = await counts();
    assert(c1.users === 0, "No accounts were created by the curriculum-only seed");
    assert(c1.lessons === GRADE7_TERM1_LESSONS.length + 1, `${GRADE7_TERM1_LESSONS.length} Term 1 lessons + the integers lesson (${c1.lessons})`);
    assert(c1.skills === GRADE7_TERM1_SKILLS.length + 3, `Skills seeded (${c1.skills})`);
    assert(c1.q === GRADE7_TERM1_QUESTIONS.length, `All ${GRADE7_TERM1_QUESTIONS.length} questions stored (${c1.q})`);
    assert(c1.sets === GRADE7_TERM1_LESSONS.length, "One practice set per Term 1 lesson");
    assert(c1.psq === GRADE7_TERM1_LESSONS.reduce((n, l) => n + l.practice.length, 0), "Practice sets hold exactly the planned questions");
    const seed2 = sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" });
    const c2 = await counts();
    assert(seed2.status === 0 && JSON.stringify(c1) === JSON.stringify(c2), "Seeding again changes nothing (idempotent)");
    const terms = await db.term.findMany({ include: { units: { orderBy: { sequenceOrder: "asc" } } }, orderBy: { termNumber: "asc" } });
    assert(terms.length === 2 && terms[0].units.length === 2 && terms[1].units.length === 1, "Term 1 has the 2 new units; Term 2 holds the integers unit");
    assert(terms[1].units[0].title === "Number and Algebra: Integers", "Integers are filed under Term 2, as in the Budget of Work");
    const orphans = await db.$queryRawUnsafe<Array<{ n: bigint }>>('SELECT count(*)::bigint AS n FROM "Question" q WHERE q."skillId" IS NULL OR q."lessonId" IS NULL');
    assert(Number(orphans[0].n) === 0, "Every seeded question has a skill and a lesson");

    console.log("\n--- B. Old database: integers unit moves from Term 1 to Term 2 ---");
    const t2 = terms[1].units[0];
    const t1 = terms[0];
    await db.unit.update({ where: { id: t2.id }, data: { termId: t1.id, title: "Numbers and Algebraic Expressions" } });
    const seed3 = sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" });
    const moved = await db.unit.findUnique({ where: { id: t2.id }, include: { term: true, lessons: true } });
    assert(seed3.status === 0 && moved?.term.termNumber === 2 && moved.title === "Number and Algebra: Integers" && moved.lessons.length === 1, "A database seeded the old way is migrated in place (same unit and lesson ids, no duplicates)");
    assert((await db.unit.count()) === c1.units, "No extra unit was created by the migration");

    console.log("\n--- C. Using it through the API ---");
    const adminEmail = `p38.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
    assert(sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P38 Admin", ADMIN_PASSWORD: adminPassword }).status === 0, "Admin bootstrapped");
    const port = 6200 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
    server = spawn("npx", ["tsx", "server.ts"], { env: { ...env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    const api = async (m: string, p: string, t?: string, b?: unknown) => {
      const r = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined });
      const text = await r.text(); let json: any = {}; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json };
    };
    const admin = (await api("POST", "/api/auth/login", undefined, { email: adminEmail, password: adminPassword })).json.token as string;
    const S = (await api("POST", "/api/auth/register", undefined, { name: "Student", email: `p38.s.${run}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    const lessons = (await api("GET", "/api/lessons", S)).json.data as any[];
    const w2 = lessons.find((x) => x.title === GRADE7_TERM1_LESSONS[1].title);
    assert((await api("GET", `/api/student/lessons/${w2.id}/access`, S)).json.data?.allowed === false, "Week 2 is locked until Week 1 is completed (the platform's lesson sequencing)");
    for (const l of GRADE7_TERM1_LESSONS) {
      const row = lessons.find((x) => x.title === l.title);
      assert(!!row, `Student can see "${l.title}"`);
      if (!row) continue;
      const det = (await api("GET", `/api/lessons/${row.id}`, S)).json.data;
      const blocks = det.contentBlocks ?? det.blocks ?? [];
      assert(blocks.length === l.blocks.length, `  ${l.key}: all ${l.blocks.length} blocks are served`);
      const cps = blocks.filter((b: any) => b.type === "CHECKPOINT");
      assert(cps.every((b: any) => !JSON.stringify(b).includes('"correctAnswer"')), `  ${l.key}: answer keys are not sent to the student`);
      // every checkpoint: the seed's intended answer is graded correct, and a wrong one is graded wrong, by the server
      const seedCps = l.blocks.filter((x) => x.type === "CHECKPOINT");
      let cpOk = cps.length === seedCps.length;
      for (const cp of cps) {
        const want = seedCps.find((x) => x.title === cp.title)?.metadata as any;
        const good = await api("POST", `/api/student/lessons/${row.id}/checkpoint`, S, { blockId: cp.id, answer: want?.correctAnswer });
        const bad = await api("POST", `/api/student/lessons/${row.id}/checkpoint`, S, { blockId: cp.id, answer: (want?.options as string[] | undefined)?.find((o) => o !== want.correctAnswer) });
        if (!(good.status === 200 && good.json.data?.isCorrect === true && bad.status === 200 && bad.json.data?.isCorrect === false)) { cpOk = false; console.error("   checkpoint problem:", cp.title, good.status, bad.status); }
      }
      assert(cpOk, `  ${l.key}: ${cps.length} checkpoints grade the intended answer correct and another option wrong`);
      const done = await api("POST", "/api/student/progress", S, { lessonId: row.id, action: "COMPLETE", completedBlockIndex: blocks.length, totalBlocks: blocks.length });
      if (done.status !== 200) console.error("   ", JSON.stringify(done.json).slice(0, 200), JSON.stringify((await api("GET", `/api/student/lessons/${row.id}/access`, S)).json));
      assert(done.status === 200, `  ${l.key}: lesson completes after its checkpoints are answered correctly (${done.status})`);
    }
    const sets = (await api("GET", "/api/practice-sets", S)).json.data as any[];
    assert(sets.filter((s) => s.title.startsWith("Practice: ")).length === GRADE7_TERM1_LESSONS.length, "Student can see the 6 practice sets");
    let allCorrect = true, totalAnswered = 0;
    for (const l of GRADE7_TERM1_LESSONS) {
      const set = sets.find((s) => s.title === `Practice: ${l.title}`);
      const start = await api("POST", "/api/practice/start", S, { practiceSetId: set.id });
      assert(start.status === 201, `  ${l.key}: practice starts`);
      const sessionId = start.json.data.id ?? start.json.data.sessionId;
      const qs = (await api("GET", `/api/practice/${sessionId}`, S)).json.data;
      const items: any[] = qs.questions ?? qs.sessionQuestions ?? [];
      assert(items.length === l.practice.length, `  ${l.key}: ${l.practice.length} questions served (${items.length})`);
      assert(!JSON.stringify(items).includes("correctAnswer"), `  ${l.key}: no answer keys in the practice questions`);
      // answer using the seed's own keys (matched by prompt) to prove the stored key grades correctly
      for (const it of items) {
        const qd = it.question ?? it;
        const seedQ = GRADE7_TERM1_QUESTIONS.find((x) => x.prompt === qd.prompt)!;
        let ans: any;
        if (seedQ.type === "MULTIPLE_CHOICE") ans = (qd.questionData?.choices ?? []).find((c: any) => c.text === seedQ.choices[seedQ.correctIndex])?.id ?? seedQ.choices[seedQ.correctIndex];
        else ans = (seedQ as any).answer;
        const r = await api("POST", `/api/practice/${sessionId}/answer`, S, { questionId: qd.id ?? it.questionId, answer: ans });
        totalAnswered++;
        if (!(r.status === 200 && r.json.data?.isCorrect === true)) { allCorrect = false; console.error("   not graded correct:", seedQ.key, r.status, JSON.stringify(r.json).slice(0, 160)); }
      }
      const done = await api("POST", `/api/practice/${sessionId}/complete`, S);
      assert(done.status === 200, `  ${l.key}: practice completes`);
    }
    assert(allCorrect && totalAnswered > 60, `Every question, answered with the intended answer, is graded correct by the server (${totalAnswered})`);
    const prog = await db.studentProgress.count();
    assert(prog >= 1, `Practice produced skill progress rows (${prog})`);
    assert((await api("GET", "/api/curriculum", admin)).status === 200, "Curriculum endpoint works for staff");
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGKILL"); } catch { /* */ } }
    await db.$disconnect();
    const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
    await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`); await drop.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 38 RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

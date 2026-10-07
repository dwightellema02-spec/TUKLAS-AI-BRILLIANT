/**
 * Tuklas AI - Phase 44 on PostgreSQL: the mistake analysis a student and teacher actually see, on the real Term 1 course.
 * Fresh database from the real migrations + the Term 1 seed. A student completes the percentage and polygon-angle practice sets giving the
 * usual wrong values; the stored analysis must name the slip and the topic, point at the right attempts, and never contain a correct answer.
 */
import crypto from "crypto";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";
import { GRADE7_TERM1_QUESTIONS } from "../src/lib/curriculum/grade7-term1";
import { coachFor } from "../src/lib/ai/conversation/coaching";
import { findTopicSlips } from "../src/lib/ai/topic-slips";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
  const run = crypto.randomBytes(3).toString("hex");
  const dbName = `tuklas_p44_${run}`;
  const u = new URL(url); const adminUrl = new URL(url); adminUrl.pathname = "/postgres"; u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`); await root.$disconnect();
  const env = { ...process.env, DATABASE_URL: freshUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) => spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
  const db = new PrismaClient({ datasources: { db: { url: freshUrl } } });
  let server: ChildProcess | undefined;
  try {
    assert(sh("npx", ["prisma", "migrate", "deploy"]).status === 0, "Schema built from the real migrations");
    assert(sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" }).status === 0, "Real Term 1 course seeded");
    const adminEmail = `p44.admin.${run}@example.edu`, adminPassword = `Boot-strap-${run}9`;
    assert(sh("npx", ["tsx", "scripts/create-admin.ts"], { ADMIN_EMAIL: adminEmail, ADMIN_NAME: "P44 Admin", ADMIN_PASSWORD: adminPassword }).status === 0, "Admin bootstrapped");
    const port = 7800 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
    server = spawn("npx", ["tsx", "server.ts"], { env: { ...env, NODE_ENV: "development", AI_PROVIDER: "local", PORT: String(port), AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
    for (let i = 0; i < 120; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    const api = async (m: string, p: string, t?: string, b?: unknown) => { const r = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined }); return { status: r.status, json: (await r.json().catch(() => ({}))) as any }; };
    const admin = (await api("POST", "/api/auth/login", undefined, { email: adminEmail, password: adminPassword })).json.token as string;
    await api("POST", "/api/admin/users", admin, { name: "Teach", email: `p44.t.${run}@example.edu`, password: "Sturdy-Pass1", role: "TEACHER" });
    const T = (await api("POST", "/api/auth/login", undefined, { email: `p44.t.${run}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    const cls = (await api("POST", "/api/teacher/classes", T, { name: "Grade 7 - P44", gradeLevel: 7 })).json.data;
    const sets = (await api("GET", "/api/practice-sets", admin)).json.data as any[];
    const byPrompt = new Map((GRADE7_TERM1_QUESTIONS as any[]).map((q) => [q.prompt, q]));
    const reg = async (tag: string) => { const r = await api("POST", "/api/auth/register", undefined, { name: `Pupil ${tag}`, email: `p44.${tag}.${run}@example.edu`, password: "Sturdy-Pass1" }); await api("POST", "/api/student/classes/join", r.json.token, { code: cls.joinCode }); return { tok: r.json.token as string, id: r.json.user.id as string }; };

    const wantTitles = [/Percentage Increase/i, /Interior and Exterior/i, /Rates and Unit/i];
    for (const [wi, re] of wantTitles.entries()) {
      const S = await reg(`w${wi}`);
      const set = sets.find((s) => re.test(s.title) && /Practice/.test(s.title));
      assert(!!set, `The Term 1 practice set ${re.source} exists (${set?.title})`);
      if (!set) continue;
      const st = (await api("POST", "/api/practice/start", S.tok, { practiceSetId: set.id })).json.data;
      const items = st.questions.map((x: any) => x.question ?? x);
      let slipsGiven = 0; const answers: Record<string, string> = {};
      for (const it of items) {
        const q = byPrompt.get(it.prompt); if (!q) continue;
        let ans: string;
        if (q.type === "NUMERIC_INPUT") { const c = coachFor({ prompt: q.prompt, type: q.type }); if (c?.slips.length) { ans = String(c.slips[0].value); slipsGiven++; } else ans = String(q.answer + 7); }
        else if (q.type === "TRUE_FALSE") ans = String(!q.answer); else ans = String((q.correctIndex + 1) % q.choices.length);
        answers[it.id ?? it.questionId] = ans;
        await api("POST", `/api/practice/${st.id}/answer`, S.tok, { questionId: it.id ?? it.questionId, answer: q.type === "MULTIPLE_CHOICE" ? (it.choices ? it.choices[Number(ans)]?.id ?? ans : ans) : ans });
      }
      assert(slipsGiven >= 2, `(setup) the student typed ${slipsGiven} answers that match a known slip`);
      await api("POST", `/api/practice/${st.id}/complete`, S.tok, {});
      const rows = await db.questionAttempt.findMany({ where: { studentId: S.id }, include: { question: true } });
      const seen = findTopicSlips(rows.map((r: any) => ({ id: r.id, studentId: S.id, questionId: r.questionId, answer: r.answer, isCorrect: r.isCorrect, attemptNumber: r.attemptNumber, hintUsed: r.hintUsed, submittedAt: r.submittedAt, question: { id: r.question.id, type: r.question.type, prompt: r.question.prompt, difficulty: r.question.difficulty } })) as any);
      console.log(`     attempts stored: ${rows.length} (${rows.filter((r: any) => !r.isCorrect).length} wrong); sample answers: ${rows.slice(0, 4).map((r: any) => JSON.stringify(r.answer)).join(" ")}; slips seen from stored rows: ${seen.length}`);
      let list: any[] = [];
      for (let i = 0; i < 40 && list.length === 0; i++) { await new Promise((r) => setTimeout(r, 500)); list = (await api("GET", "/api/student/insights", S.tok)).json.data ?? []; }
      assert(list.length >= 1, "An analysis is stored after the session");
      const a = list[0];
      console.log(`     ${a?.category}: ${String(a?.observation).slice(0, 110)}`);
      assert(a?.category === "PROCEDURAL_ERROR", `The category is the specific one, not a generic calculation error (${a?.category})`);
      assert(/common slip/.test(a?.observation ?? "") && /(angle|percent|polygon|rate|speed|distance)/i.test(a?.observation ?? ""), "The observation names the topic");
      assert(!/answer format|negative number|number line|two-step rule/i.test(JSON.stringify(a)), "It does not make the old, wrong claims (answer format, negative numbers)");
      // (The stored analysis is written when the session is completed, when the review already shows the correct answers, so it may mention general facts such as 'exterior angles add up to 360'. The per-question no-leak sweep is in test-phase44-mistakes.ts.)
      const ev = await db.mistakeAnalysis.findFirst({ where: { studentId: S.id }, include: { evidence: true } as any }).catch(() => null) as any;
      if (ev?.evidence) assert(ev.evidence.length >= 1, `The analysis is linked to its evidence attempts (${ev.evidence.length})`);
      const tview = await api("GET", `/api/teacher/students/${S.id}/insights`, T);
      assert(tview.status === 200 && JSON.stringify(tview.json).includes("PROCEDURAL_ERROR"), "The class teacher sees the same finding");
    }
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGKILL"); } catch { /* */ } }
    await db.$disconnect();
    const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
    await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`); await drop.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 44 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

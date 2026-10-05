/**
 * Tuklas AI - Phase 40 on PostgreSQL: the built-in tutor, through the real API, on the real Term 1 practice questions.
 * Fresh database + curriculum-only seed; for every practice question a new student runs an 8-turn conversation (a wrong answer, hints,
 * "show me an example", "just tell me the answer", ...). Checks: the answer is never stated, no integer talk, topic content is present,
 * recognised slips are named, and the right answer is still confirmed.
 */
import crypto from "crypto";
import { spawn, spawnSync, type ChildProcess } from "child_process";
import { PrismaClient } from "@prisma/client";
import { GRADE7_TERM1_QUESTIONS, GRADE7_TERM1_LESSONS } from "../src/lib/curriculum/grade7-term1";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\//.test(url)) { console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script."); return; }
  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
  const run = crypto.randomBytes(3).toString("hex");
  const dbName = `tuklas_p40_${run}`;
  const u = new URL(url); const adminUrl = new URL(url); adminUrl.pathname = "/postgres"; u.pathname = `/${dbName}`;
  const freshUrl = u.toString();
  const root = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  await root.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`); await root.$disconnect();
  const env = { ...process.env, DATABASE_URL: freshUrl, NODE_ENV: "production" } as NodeJS.ProcessEnv;
  const sh = (cmd: string, args: string[], extra: Record<string, string> = {}) => spawnSync(cmd, args, { env: { ...env, ...extra }, encoding: "utf-8", maxBuffer: 20 * 1024 * 1024 });
  let server: ChildProcess | undefined;
  try {
    assert(sh("npx", ["prisma", "db", "push", "--skip-generate"]).status === 0, "Schema applied");
    assert(sh("npx", ["tsx", "prisma/seed.ts"], { SEED_CURRICULUM_ONLY: "true" }).status === 0, "Real Term 1 curriculum seeded");
    const port = 6400 + Math.floor(Math.random() * 90), base = `http://127.0.0.1:${port}`;
    server = spawn("npx", ["tsx", "server.ts"], { env: { ...env, PORT: String(port), NODE_ENV: "development", AI_PROVIDER: "local", AUTH_SECRET: crypto.randomBytes(16).toString("hex") }, stdio: "ignore", detached: true });
    for (let i = 0; i < 90; i++) { await new Promise((r) => setTimeout(r, 500)); try { if ((await fetch(`${base}/api/health`)).ok) break; } catch { /* */ } }
    const api = async (m: string, p: string, t?: string, b?: unknown) => {
      const r = await fetch(base + p, { method: m, headers: { ...(b !== undefined ? { "Content-Type": "application/json" } : {}), ...(t ? { Authorization: `Bearer ${t}` } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined });
      const text = await r.text(); let json: any = {}; try { json = JSON.parse(text); } catch { /* */ } return { status: r.status, json };
    };
    let n = 0;
    const fresh = async () => (await api("POST", "/api/auth/register", undefined, { name: "S", email: `p40.${run}.${n++}@example.edu`, password: "Sturdy-Pass1" })).json.token as string;
    const sets = (await api("GET", "/api/practice-sets", await fresh())).json.data.filter((s: any) => s.title.startsWith("Practice: "));
    const hasToken = (text: string, x: number) => new RegExp(`(?<![\\d.])${String(x).replace(".", "\\.")}(?![\\d])`).test(text.replace(/,/g, ""));
    const INTEGER_TALK = /number line|negative number|absolute value|temperature|direction from zero|size and a sign|below zero/i;
    const TOPIC = /percent|original|change|angle|polygon|sides|rate|unit|speed|distance|price|discount|interest|savings|degree|triangle|total|sale|income|expense|time|commission|tax|prefix|turn|circle/i;
    const TURNS: Array<[string, number, string?]> = [["Is my answer right?", 1, "WRONG"], ["I need a hint", 1], ["I still don't get it", 2], ["Can you show me an example?", 2], ["Give me a real-life example", 2], ["I feel stuck", 3], ["Just tell me the answer", 3], ["Can you explain this lesson again?", 2]];

    console.log("--- A. 72 practice questions, 8-turn conversation each ---");
    const lessonOf = new Map(GRADE7_TERM1_LESSONS.flatMap((l) => l.practice.map((k) => [k, l.title] as const)));
    let convs = 0, leaks = 0, integerTalk = 0, topical = 0, throttled = 0, duplicated = 0, genericOnly = 0;
    const confirms: string[] = [];
    for (const q of GRADE7_TERM1_QUESTIONS) {
      const title = lessonOf.get(q.key);
      if (!title) continue;
      const set = sets.find((s: any) => s.title === `Practice: ${title}`);
      const S = await fresh();
      const st = (await api("POST", "/api/practice/start", S, { practiceSetId: set.id })).json.data;
      const item = st.questions.map((x: any) => x.question ?? x).find((x: any) => x.prompt === q.prompt);
      if (!item) continue;
      convs++;
      let conv: string | undefined;
      const msgs: string[] = [];
      for (const [text, lvl, kind] of TURNS) {
        const wrong = q.type === "NUMERIC_INPUT" ? String(q.answer + 7) : q.type === "TRUE_FALSE" ? String(!q.answer) : undefined;
        const r = await api("POST", "/api/ai/tutor", S, { conversationId: conv, practiceSessionId: st.id, questionId: item.id ?? item.questionId, studentQuery: text, studentAnswer: kind === "WRONG" ? wrong : undefined, helpLevel: lvl });
        if (r.status === 429) { throttled++; break; }
        const d = r.json.data ?? {}; conv = d.conversationId ?? conv;
        const m = d.message; msgs.push([m?.content ?? "", m?.guidingQuestion ?? "", d.guidingQuestion ?? ""].join(" "));
      }
      const all = msgs.join(" ");
      if (q.type === "NUMERIC_INPUT" && hasToken(all, q.answer)) { leaks++; console.error(`   ANSWER STATED (${q.key}, ${q.answer}): ${msgs.find((x) => hasToken(x, q.answer))?.slice(0, 220)}`); }
      if (INTEGER_TALK.test(all)) { integerTalk++; console.error(`   integer talk (${q.key}): ${msgs.find((x) => INTEGER_TALK.test(x))?.slice(0, 200)}`); }
      if (msgs.filter((x) => TOPIC.test(x)).length >= 3) topical++; else console.error(`   few topic words (${q.key}): ${msgs.map((x) => x.slice(0, 60)).join(" | ")}`);
      if (new Set(msgs).size < msgs.length - 1) duplicated++;
      if (msgs.every((x) => /^(Let's figure out where you are|Let's break it into small steps)/.test(x))) genericOnly++;
    }
    assert(convs >= 60, `Conversations run on ${convs} real practice questions (${throttled} throttled)`);
    assert(leaks === 0, `The correct answer is never stated in any tutor message, including after "just tell me the answer" (${leaks} leaks)`);
    assert(integerTalk === 0, `No integer facts on these topics (${integerTalk})`);
    assert(topical >= convs * 0.95, `Messages carry topic content for ${topical}/${convs} conversations`);
    assert(duplicated === 0, `The tutor does not repeat itself within a conversation (${duplicated} conversations repeated)`);
    assert(genericOnly === 0, "No conversation is only generic filler");

    console.log("\n--- B. Recognised slips, and the right answer ---");
    const ask = async (title: string, frag: string, answer: string, query = "Is my answer right?") => {
      const set = sets.find((s: any) => s.title === `Practice: ${title}`); const S = await fresh();
      const st = (await api("POST", "/api/practice/start", S, { practiceSetId: set.id })).json.data;
      const it = st.questions.map((x: any) => x.question ?? x).find((x: any) => x.prompt.includes(frag));
      const r = await api("POST", "/api/ai/tutor", S, { practiceSessionId: st.id, questionId: it.id ?? it.questionId, studentQuery: query, studentAnswer: answer, helpLevel: 1 });
      const d = r.json.data ?? {}; return `${d.message?.content ?? ""} ${d.message?.guidingQuestion ?? d.guidingQuestion ?? ""}`;
    };
    const T = "Percentage Increase and Percentage Decrease";
    let m = await ask(T, "rises from 200 to 250", "20");
    assert(/new value|started|original|start/i.test(m) && !/\b25\b/.test(m), `Dividing by the new value (20) is named without giving 25: "${m.slice(0, 160)}"`);
    m = await ask(T, "rises from 200 to 250", "50");
    assert(/change itself|compare|original/i.test(m) && !/\b25\b/.test(m), `Giving the change (50) is named: "${m.slice(0, 160)}"`);
    m = await ask(T, "rises from 200 to 250", "25");
    assert(/right|correct/i.test(m), `The correct answer is confirmed: "${m.slice(0, 100)}"`);
    m = await ask("Interior and Exterior Angles of Polygons", "sum of the interior angles of a polygon with 5 sides", "900");
    assert(/triangle|sides|fewer/i.test(m) && !/\b540\b/.test(m), `Using sides x 180 (900) is named without giving 540: "${m.slice(0, 160)}"`);
    m = await ask("Rates and Unit Rates", "jeepney travels 240 km in 4 hours", "0.02");
    assert(m.length > 20 && !/\b60\b/.test(m), `A wrong speed gets guidance without the value: "${m.slice(0, 160)}"`);
  } finally {
    if (server?.pid) { try { process.kill(-server.pid, "SIGKILL"); } catch { /* */ } }
    const drop = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
    await drop.$executeRawUnsafe(`DROP DATABASE "${dbName}" WITH (FORCE)`); await drop.$disconnect();
  }
  console.log(`\nPOSTGRES PHASE 40 RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

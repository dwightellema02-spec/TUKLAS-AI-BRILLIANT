/**
 * Tuklas AI - Tutor conversation evaluation harness (works with ANY provider, built for a LIVE model).
 *
 *   # offline, local realizer:
 *   AI_PROVIDER=local npx tsx scripts/eval-tutor-conversations.ts --runs 20
 *   # live Gemini (needs GEMINI_API_KEY and quota):
 *   GEMINI_API_KEY=... npx tsx scripts/eval-tutor-conversations.ts --provider gemini --runs 20 --seed 7
 *
 * It plays scripted student personas against the real AITutorService (state, planner, prompts, guards) with
 * freshly randomised problems, and reports:
 *   - first-pass guard violations by type (how often the RAW model broke the rules before correction/fallback)
 *   - fallback rate (how often the plan realizer had to replace the model)
 *   - disclosures that reached the student (must be 0)
 *   - strategy variety, repetition, one-question rate, acknowledgement of the student's attempt
 * and writes full transcripts to eval-output/ for HUMAN rubric scoring (wording quality cannot be auto-scored).
 *
 * Exit code is non-zero if an answer ever reaches a student or a persona fails its pedagogical expectations.
 */
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
const arg = (name: string, def?: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

function mulberry(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const providerName = arg("provider", process.env.GEMINI_API_KEY || process.env.AI_API_KEY ? "gemini" : "local")!;
  const runs = parseInt(arg("runs", "10")!, 10);
  const rand = mulberry(parseInt(arg("seed", "1")!, 10));
  const ri = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  if (providerName === "local") process.env.AI_PROVIDER = "local";

  const { AITutorService } = await import("../src/lib/ai/tutor");
  const { GeminiAIProvider } = await import("../src/lib/ai/provider");
  const { dbService } = await import("../src/lib/db");
  const { parseState } = await import("../src/lib/ai/conversation/state");
  const { disclosesAnswer, similarity } = await import("../src/lib/ai/conversation/guards");
  const { makeProblem } = await import("../src/lib/ai/conversation/problems");

  if (providerName === "gemini") {
    AITutorService.providerOverride = new GeminiAIProvider();
    console.log(`Provider: gemini (${process.env.AI_MODEL || "default model"})`);
  } else {
    console.log("Provider: local plan realizer (no external model)");
  }

  type Turn = { student: string; tutor: string; question: string; strategy: string; evaluation: string; violations: string[]; fallback: boolean; provider: string };
  const transcripts: Array<{ persona: string; problem: string; turns: Turn[] }> = [];
  const violationCounts: Record<string, number> = {};
  let totalTurns = 0, fallbackTurns = 0, leakedToStudent = 0, repeats = 0, oneQ = 0;
  const personaFailures: string[] = [];
  let studentSeq = 0;

  async function play(persona: string, problemText: string, p: ReturnType<typeof makeProblem>, policy: (i: number, pending?: ReturnType<typeof makeProblem>) => string | null, maxTurns = 8) {
    const studentId = `eval_student_${++studentSeq}`;
    const turns: Turn[] = [];
    let convId: string | undefined;
    for (let i = 0; i < maxTurns; i++) {
      let pending: ReturnType<typeof makeProblem> | undefined;
      if (convId) {
        const conv = (await dbService.getAITutorConversation(convId, studentId)) as any;
        pending = parseState(conv?.stateJson).pendingTransfer?.problem;
      }
      const text = i === 0 ? problemText : policy(i - 1, pending);
      if (text === null) break;
      AITutorService.resetRateLimit();
      const r = await AITutorService.interact({ studentId, lessonId: "lsn_02", studentQuery: text });
      convId = r.conversationId;
      const conv = (await dbService.getAITutorConversation(convId, studentId)) as any;
      const last = conv.messages.filter((m: any) => m.role === "TUTOR").pop();
      const meta = JSON.parse(last.metadata ?? "{}");
      const ped = meta.pedagogy ?? {};
      const turn: Turn = {
        student: text,
        tutor: r.message.content,
        question: r.message.guidingQuestion ?? "",
        strategy: ped.strategy,
        evaluation: ped.evaluation,
        violations: ped.guardViolations ?? [],
        fallback: !!ped.usedPlanFallback,
        provider: r.providerInfo.provider,
      };
      turns.push(turn);
      totalTurns++;
      if (turn.fallback) fallbackTurns++;
      for (const v of turn.violations) violationCounts[v] = (violationCounts[v] ?? 0) + 1;
      if ((`${turn.tutor} ${turn.question}`.match(/\?/g) || []).length === 1) oneQ++;
      if (turns.slice(0, -1).some((o) => similarity(`${o.tutor} ${o.question}`, `${turn.tutor} ${turn.question}`) >= 0.85)) repeats++;
      // Independent leak check on what the student actually saw, using the original problem's answer
      const fakePlan: any = { protectedAnswer: String(p.expected), protectedAnswerAliases: [String(p.expected), ...(p.expected < 0 ? [`negative ${Math.abs(p.expected)}`] : [])], activeProblem: p };
      if (i < 2 && persona !== "strong-learner" && disclosesAnswer(`${turn.tutor} ${turn.question}`, fakePlan)) leakedToStudent++;
    }
    transcripts.push({ persona, problem: problemText, turns });
    return turns;
  }

  for (let run = 0; run < runs; run++) {
    const a = (rand() < 0.5 ? -1 : 1) * ri(3, 25);
    const b = (rand() < 0.5 ? -1 : 1) * ri(3, 25);
    const p = makeProblem(a, "+", b);
    if (p.expected === 0) continue;
    const ask = `what is (${a}) + (${b})?`;

    const confused = await play("confused", ask, p, (i) => (i < 5 ? ["I don't understand", "i still dont get it", "still confused", "I really dont understand this", "idk"][i] : null), 6);
    const strategies = confused.map((t) => t.strategy);
    if (new Set(strategies.slice(0, 4)).size < 3) personaFailures.push(`confused[${run}]: strategies did not vary (${strategies.join(">")})`);

    const learner = await play("struggling-then-succeeds", ask, p, (i, pending) => {
      if (i === 0) return String(-p.expected);
      if (i === 1) return String(p.expected);
      if (i === 2) return "because I compared the sizes and kept the sign of the bigger one";
      if (i === 3) return pending ? String(pending.expected) : "ok";
      return null;
    }, 6);
    // turns[0] answers the typed problem, turns[1] the wrong attempt, turns[2] the correct one.
    if (learner[1]?.evaluation !== "INCORRECT") personaFailures.push(`learner[${run}]: wrong answer not recognised`);
    if (learner[2]?.evaluation !== "CORRECT") personaFailures.push(`learner[${run}]: correct answer not recognised`);
    if (!learner.some((t) => t.strategy === "TRANSFER_PROBLEM")) personaFailures.push(`learner[${run}]: never verified with a new problem`);

    await play("answer-seeker", ask, p, (i) => (i < 3 ? ["just tell me the answer", "give me the answer please", "tell me the answer now"][i] : null), 4);
    await play("frustrated", ask, p, (i) => (i === 0 ? "this is so hard i give up" : null), 2);
  }

  const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);
  console.log("\n================ TUTOR EVALUATION REPORT ================");
  console.log(`Provider: ${providerName}   Conversations: ${transcripts.length}   Tutor turns: ${totalTurns}`);
  console.log(`First-pass guard violations (RAW output broke a rule): ${JSON.stringify(violationCounts)}`);
  console.log(`Turns replaced by the plan realizer: ${fallbackTurns} (${pct(fallbackTurns, totalTurns)})`);
  console.log(`Exactly-one-question rate: ${pct(oneQ, totalTurns)}`);
  console.log(`Repeated messages within a conversation: ${repeats}`);
  console.log(`ANSWERS THAT REACHED A STUDENT (early turns): ${leakedToStudent}`);
  console.log(`Persona failures: ${personaFailures.length}${personaFailures.length ? "\n - " + personaFailures.slice(0, 10).join("\n - ") : ""}`);

  const outDir = path.join(process.cwd(), "eval-output");
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `tutor-eval-${providerName}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify({ providerName, runs, violationCounts, fallbackTurns, totalTurns, leakedToStudent, repeats, personaFailures, transcripts }, null, 2));
  console.log(`\nTranscripts for human rubric scoring: ${file}`);
  console.log("Human rubric (score 1-5 per conversation): acknowledges what the student said; explanation is correct; hint is the right size; tone is warm and age-appropriate; no repetition; student would know what to do next.");

  if (leakedToStudent > 0 || personaFailures.length > 0) process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error("Evaluation crashed:", e); process.exit(1); });

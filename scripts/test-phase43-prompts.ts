/**
 * Tuklas AI - Phase 43: nothing that identifies the student reaches the external AI. A capturing stand-in provider records every prompt the
 * tutor builds (system + user, including the retry prompt); the student has a distinctive name and email, and the prompts must contain neither,
 * nor the account id. (What a student TYPES is sent as written: the privacy notice tells them not to type personal details.)
 *   AI_PROVIDER=local npx tsx scripts/test-phase43-prompts.ts
 */
import crypto from "crypto";
process.env.AI_PROVIDER = "local";
process.env.AUTH_SECRET = crypto.randomBytes(32).toString("hex");

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };

async function main() {
  const { dbService } = await import("../src/lib/db");
  const { AITutorService } = await import("../src/lib/ai/tutor");
  const run = crypto.randomBytes(3).toString("hex");
  const name = `Zephyrine Quillfeather${run}`, mail = `zq.${run}@privacy-test.example`;
  const u: any = await dbService.createUser({ name, email: mail, passwordHash: "x", role: "STUDENT" } as any);
  const captured: string[] = [];
  const J = (o: any) => JSON.stringify({ responseType: "HINT", hintLevel: 1, encouragement: "Keep going!", ...o });
  let n = 0;
  (AITutorService as any).providerOverride = {
    name: "capture", defaultModel: "capture",
    async generateTutorResponse(req: any) {
      captured.push(req.systemPrompt, req.userPrompt);
      // first reply discloses the answer so the retry prompt is exercised too
      const text = n++ === 0 ? J({ message: "The answer is 5.", guidingQuestion: "Ok?" }) : J({ message: "Let's check the signs.", guidingQuestion: "Which number is farther from zero?" });
      return { text, provider: "capture", model: "capture" };
    },
  };
  try {
    AITutorService.resetRateLimit();
    const r = await AITutorService.interact({ studentId: u.id, lessonId: "lsn_02", questionId: "qst_09", studentQuery: "what is the answer" });
    assert(captured.length >= 4, `The provider was called twice (original + retry): ${captured.length / 2} call(s)`);
    const all = captured.join("\n");
    assert(!all.includes("Zephyrine") && !all.includes("Quillfeather"), "No prompt contains the student's name");
    assert(!all.includes(mail) && !/privacy-test\.example/.test(all), "No prompt contains the student's email");
    assert(!all.includes(u.id), "No prompt contains the account id");
    assert(/Student|student/.test(all) && all.length > 500, "(sanity) the prompts are real, non-trivial tutor prompts");
    assert(!!r.message?.content, "The student still gets a reply");
  } finally { (AITutorService as any).providerOverride = null; }
  console.log(`\nPHASE 43 PROMPT RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

/**
 * Tuklas AI - Phase 44: the mistake analyzer on the real Grade 7 Term 1 questions. Pure logic, no server.
 *   npx tsx scripts/test-phase44-mistakes.ts
 * Before this phase, an all-wrong run on 16 of the 17 Term 1 skills was reported as "unfamiliar with the answer format" (wrong), polygon
 * questions were reported as a negative-number problem because of a hyphen in the text, and nothing on these topics was recognised.
 */
import { GRADE7_TERM1_QUESTIONS, GRADE7_TERM1_SKILLS } from "../src/lib/curriculum/grade7-term1";
import { coachFor } from "../src/lib/ai/conversation/coaching";
import { runDeterministicAnalysis, generateDeterministicMistakeCategory, mentionsNegative } from "../src/lib/ai/deterministic-analyzer";
import { MistakeAnalyzerService } from "../src/lib/ai/mistake-analyzer";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);
const att = (id: string, q: any, answer: string, isCorrect = false, n = 1) => ({ id, studentId: "s", questionId: q.key ?? q.id, answer, isCorrect, attemptNumber: n, hintUsed: false, submittedAt: new Date(), question: { id: q.key ?? q.id, type: q.type, prompt: q.prompt, difficulty: q.difficulty ?? "MEDIUM" } }) as any;
const wrongOf = (q: any) => q.type === "NUMERIC_INPUT" ? String(q.answer + 7) : q.type === "TRUE_FALSE" ? String(!q.answer) : String((q.correctIndex + 1) % q.choices.length);
const analyse = (attempts: any[]) => { const r = runDeterministicAnalysis(attempts); return { r, c: generateDeterministicMistakeCategory(r, attempts) }; };
const QS = GRADE7_TERM1_QUESTIONS as any[];

section("1. A hyphen is not a negative number");
assert(!mentionsNegative("A two-step problem: find the well-known value") && !mentionsNegative("3-sided shape") && !mentionsNegative("1 - 2 sides"), "'two-step', 'well-known', '3-sided' and a spaced dash between words do not count");
assert(mentionsNegative("Compare -5 and -2") && mentionsNegative("What is (-3) + 8?") && mentionsNegative("a negative number") && mentionsNegative("−7 + 2"), "'-5', '(-3)', the word 'negative' and a real minus sign do count");
let falseSigns = 0, hyphenQs = 0;
for (const sk of GRADE7_TERM1_SKILLS) {
  const qs = QS.filter((q) => q.skill === sk.key).slice(0, 4);
  if (qs.some((q) => q.prompt.includes("-"))) hyphenQs++;
  const { r } = analyse(qs.map((q, i) => att(`a${i}`, q, wrongOf(q))));
  if (r.signErrorDetected || r.comparisonErrorDetected) falseSigns++;
}
assert(falseSigns === 0, `No Term 1 skill is reported as a sign or negative-number comparison problem (${hyphenQs} skills have a hyphen somewhere in their questions)`);

section("2. Integer behaviour is kept");
const intQ = { key: "i1", type: "MULTIPLE_CHOICE", prompt: "Which is greater: -5 or -2?" };
const cmp = analyse([att("1", intQ, "-5"), att("2", { ...intQ, key: "i2" }, "-9"), att("3", { ...intQ, key: "i3" }, "-7")]);
assert(cmp.c.category === "CONCEPTUAL_MISUNDERSTANDING" && /number line/i.test(cmp.c.recommendation), "Repeated misses comparing negatives are still a number-line misunderstanding");
const sgn = analyse([att("1", { key: "s1", type: "NUMERIC_INPUT", prompt: "What is (-8) + 13?" }, "-5"), att("2", { key: "s2", type: "NUMERIC_INPUT", prompt: "What is (-3) + 9?" }, "-6")]);
assert(sgn.c.category === "SIGN_ERROR", "Repeated misses on signed arithmetic are still a sign error");
assert(MistakeAnalyzerService.evaluateAttempt({ prompt: "Order these from least to greatest: -3, -8, -1", studentAnswer: "x", correctAnswer: "y" }).category === "CONCEPTUAL_MISUNDERSTANDING", "The single-attempt check still recognises negative ordering");
assert(MistakeAnalyzerService.evaluateAttempt({ prompt: "Which polygon is a well-known 6-sided shape? Compare the sides", studentAnswer: "4", correctAnswer: "6" }).category === "CALCULATION_ERROR", "...but a hyphen in a polygon question is not mistaken for it");

section("3. Failing everything is a topic problem, not an answer-format problem");
let formatClaims = 0;
for (const sk of GRADE7_TERM1_SKILLS) {
  const qs = QS.filter((q) => q.skill === sk.key).slice(0, 4);
  if (qs.length < 3) continue;
  if (analyse(qs.map((q, i) => att(`a${i}`, q, wrongOf(q)))).c.category === "QUESTION_TYPE_DIFFICULTY") formatClaims++;
}
assert(formatClaims === 0, "No skill's all-wrong run is blamed on the answer format");
const mc = QS.filter((q) => q.type === "MULTIPLE_CHOICE").slice(0, 3), nu = QS.filter((q) => q.type === "NUMERIC_INPUT").slice(0, 4);
const mixed = analyse([...mc.map((q, i) => att(`m${i}`, q, wrongOf(q))), ...nu.map((q, i) => att(`n${i}`, q, String(q.answer), true))]);
assert(mixed.c.category === "QUESTION_TYPE_DIFFICULTY", "Zero on multiple choice while the numeric questions are right is still reported as a format difficulty");

section("4. Choice and true/false misses are about ideas");
const tf = QS.filter((q) => q.type === "TRUE_FALSE").slice(0, 3);
const tfRes = analyse(tf.map((q, i) => att(`t${i}`, q, wrongOf(q))));
assert(tfRes.c.category === "CONCEPTUAL_MISUNDERSTANDING" && !/computation|miscalculation/i.test(JSON.stringify(tfRes.c)), "Missing true/false questions is a conceptual finding, not 'arithmetic errors'");
assert(analyse(nu.map((q, i) => att(`n${i}`, q, String(q.answer + 7)))).c.category !== "CONCEPTUAL_MISUNDERSTANDING", "Arbitrary wrong numbers (no known slip) stay a general calculation finding");

section("5. Known slips on the Term 1 topics are recognised");
let numeric = 0, withSlips = 0, slipsTotal = 0, recognised = 0, equalsAnswer = 0, leaks = 0, empty = 0; const kindsSeen = new Set<string>();
for (const q of QS) {
  if (q.type !== "NUMERIC_INPUT") continue; numeric++;
  const c = coachFor({ prompt: q.prompt, type: q.type });
  if (!c || c.slips.length === 0) continue; withSlips++; kindsSeen.add(c.kind);
  for (const sl of c.slips) {
    slipsTotal++;
    if (Math.abs(sl.value - q.answer) < 0.06) { equalsAnswer++; continue; }
    const { c: m } = analyse([att("a1", q, String(sl.value))]);
    if (m.category === "PROCEDURAL_ERROR" && m.evidenceAttemptIds.join() === "a1") recognised++;
    if (!m.observation || !m.pattern || !m.recommendation || !m.possibleCause) empty++;
    const text = `${m.observation} ${m.pattern} ${m.possibleCause} ${m.recommendation}`.replace(/,/g, "");
    const ans = String(q.answer);
    if (new RegExp(`(?<![\\d.])${ans.replace(".", "\\.")}(?![\\d])`).test(text)) leaks++;
  }
}
assert(withSlips >= 70, `Coaching knows the usual slips for ${withSlips} of the ${numeric} numeric Term 1 questions (${kindsSeen.size} kinds of problem)`);
assert(equalsAnswer === 0, "No known-slip value equals the correct answer (a slip is always wrong)");
assert(recognised === slipsTotal, `Every one of the ${slipsTotal} known slip values is reported as a PROCEDURAL_ERROR pointing at that attempt (${recognised})`);
assert(empty === 0, "Every finding has an observation, pattern, cause and recommendation");
assert(leaks === 0, "No finding contains the question's correct answer");
const q0 = QS.find((q) => q.type === "NUMERIC_INPUT" && coachFor({ prompt: q.prompt, type: q.type })?.slips.length)!;
const sl0 = coachFor({ prompt: q0.prompt, type: q0.type })!.slips[0];
const two = analyse([att("a1", q0, String(sl0.value)), att("a2", q0, String(q0.answer + 99))]);
assert(two.c.category === "PROCEDURAL_ERROR" && two.c.evidenceAttemptIds.join() === "a1" && /1 of 2/.test(two.c.observation), "With one recognised slip among two misses the finding says '1 of 2' and cites only that attempt");
const many = analyse([att("a1", q0, String(sl0.value)), ...[2, 3, 4, 5].map((i) => att(`a${i}`, q0, String(q0.answer + i * 11)))]);
assert(many.c.category !== "PROCEDURAL_ERROR", "One slip among five unrelated misses is not claimed as the pattern");
const sl1 = coachFor({ prompt: q0.prompt, type: q0.type })!.slips[0];
const some = analyse([att("a1", q0, String(sl1.value)), att("a2", q0, String(sl1.value)), ...[3, 4, 5, 6, 7, 8].map((i) => att(`a${i}`, q0, String(q0.answer + i * 11)))]);
assert(some.c.category === "PROCEDURAL_ERROR" && /2 of 8/.test(some.c.observation) && some.c.confidence < 0.7, "Two slips among eight misses are reported honestly as '2 of 8' with lower confidence");
// a correct answer is never read as a slip; a non-numeric answer is not read as one
assert(analyse([att("a1", q0, String(q0.answer), true), att("a2", q0, String(q0.answer), true), att("a3", q0, String(q0.answer), true), att("a4", q0, String(q0.answer), true)]).c.category !== "PROCEDURAL_ERROR", "Correct answers are never read as slips");
assert(analyse([att("a1", q0, "abc"), att("a2", q0, "")]).c.category !== "PROCEDURAL_ERROR", "Non-numeric or empty answers are not read as slips");

console.log(`\nPHASE 44 MISTAKE RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

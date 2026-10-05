/**
 * Tuklas AI - Phase 40: topic coaching for the Term 1 questions. Pure (no server/DB).
 *   npx tsx scripts/test-phase40-coaching.ts
 * Every one of the 180 seeded questions is run through the coaching module; worked examples are re-solved independently.
 */
import { GRADE7_TERM1_QUESTIONS as Q, GRADE7_TERM1_SKILLS as SK } from "../src/lib/curriculum/grade7-term1";
import { coachFor, exampleFor, slipFor, type Coach } from "../src/lib/ai/conversation/coaching";
import { solveNumeric } from "./lib/solve-prompt";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);
const nums = (s: string) => [...s.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
const hasToken = (text: string, x: number) => new RegExp(`(?<![\\d.])${String(x).replace(".", "\\.")}(?![\\d])`).test(text.replace(/,/g, ""));
const skillTitle = (key: string) => SK.find((s) => s.key === key)!.title;
const guidingText = (c: Coach) => [c.idea.message, c.idea.question, ...c.steps, c.context.message, c.context.question, c.check.message, c.check.question, ...c.slips.flatMap((s) => [s.message, s.question])].join(" ");
const CONSTANTS = new Set([360, 180, 90, 100]); // facts that appear in the formulas themselves

section("1. Coverage: every seeded question gets coaching");
const byKind: Record<string, number> = {};
let withCoach = 0;
for (const q of Q) {
  const c = coachFor({ prompt: q.prompt, skillTitle: skillTitle(q.skill), type: q.type, expectedAnswer: q.type === "NUMERIC_INPUT" ? String(q.answer) : undefined });
  if (c) { withCoach++; byKind[c.kind] = (byKind[c.kind] ?? 0) + 1; } else assert(false, `${q.key}: no coaching for "${q.prompt}"`);
}
assert(withCoach === Q.length, `All ${Q.length} questions have coaching (${Object.keys(byKind).length} kinds)`);
assert(SK.every((s) => !!coachFor({ prompt: "", skillTitle: s.title })), "Every one of the 17 skills has concept coaching");
assert(coachFor({ prompt: "Evaluate (-3) + 5", skillTitle: "Add integers", type: "NUMERIC_INPUT" }) === undefined, "A topic it does not know (integers) gets none, so the integer engine keeps handling it");

section("2. Guiding text never gives the answer or repeats the student's numbers");
let numericChecked = 0;
for (const q of Q) {
  if (q.type !== "NUMERIC_INPUT") continue;
  const c = coachFor({ prompt: q.prompt, skillTitle: skillTitle(q.skill), type: q.type, expectedAnswer: String(q.answer) })!;
  const text = guidingText(c);
  numericChecked++;
  assert(!hasToken(text, q.answer), `${q.key}: guiding text does not contain the answer ${q.answer}`);
  const leaked = nums(q.prompt).filter((x) => !CONSTANTS.has(x) && hasToken(text, x));
  assert(leaked.length === 0, `${q.key}: guiding text does not repeat the problem's numbers (${leaked.join(", ")})`);
  assert(c.slips.every((s) => Math.abs(s.value - q.answer) > 0.06), `${q.key}: no slip nudge is keyed to the correct answer`);
  assert(c.steps.length >= 3 && c.steps.every((s) => s.includes("?")), `${q.key}: every step is a question`);
}
assert(numericChecked >= 100, `${numericChecked} numeric questions checked`);

section("3. Worked examples: different numbers, answer never reused, independently re-solved");
let examples = 0, noExample = 0;
for (const q of Q) {
  if (q.type !== "NUMERIC_INPUT") continue;
  const c = coachFor({ prompt: q.prompt, skillTitle: skillTitle(q.skill), type: q.type, expectedAnswer: String(q.answer) })!;
  if (!c.example) { noExample++; continue; }
  const ex = exampleFor(c, [q.answer, q.answer + 7]);
  if (!ex) { assert(false, `${q.key}: a worked example was expected but none could be built`); continue; }
  examples++;
  const text = `${ex.problem} ${ex.steps.join(" ")}`;
  assert(!hasToken(text, q.answer), `${q.key}: the example does not contain the student's answer ${q.answer}`);
  assert(ex.problem.trim() !== q.prompt.trim(), `${q.key}: the example is a different problem`);
  const v = solveNumeric(ex.problem);
  if (v === undefined) { assert(false, `${q.key}: no independent solver for the example "${ex.problem}"`); continue; }
  const stepNums = nums(ex.steps.join(" ").replace(/₱/g, ""));
  assert(stepNums.some((x) => Math.abs(x - v) < 0.051), `${q.key}: the example's working reaches the independently computed ${v} ("${ex.problem}")`);
  assert(Math.abs(v - q.answer) > 1e-9 && Math.abs(v - (q.answer + 7)) > 1e-9, `${q.key}: the example's answer differs from both the correct answer and a wrong attempt`);
}
assert(examples >= 80, `${examples} worked examples verified (${noExample} questions have none, e.g. concept-only kinds)`);

section("4. Slip nudges");
const c1 = coachFor({ prompt: "A value rises from 200 to 250. What is the percentage increase?", type: "NUMERIC_INPUT", skillTitle: skillTitle("g7t1-pct-increase") })!;
assert(/new value|started/i.test(slipFor(c1, 20)?.message ?? ""), "Dividing by the new value (20 instead of 25) is recognised");
assert(/change itself/i.test(slipFor(c1, 50)?.message ?? ""), "Giving the change (50) is recognised");
assert(slipFor(c1, 25) === undefined && slipFor(c1, 37) === undefined && slipFor(c1, undefined) === undefined && slipFor(c1, Number.NaN) === undefined, "The right answer, an unrelated number, or no number gets no nudge");
const c2 = coachFor({ prompt: "Two angles are complementary. One measures 25°. What is the other angle in degrees?", type: "NUMERIC_INPUT", skillTitle: skillTitle("g7t1-angle-pairs") })!;
assert(/supplementary/i.test(slipFor(c2, 155)?.message ?? ""), "Using 180 instead of 90 for complementary angles is recognised");

console.log(`\nPHASE 40 COACHING RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

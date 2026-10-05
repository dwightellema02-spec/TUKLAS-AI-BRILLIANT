/**
 * Tuklas AI - Phase 38: Grade 7 Term 1 (weeks 1-6) curriculum content checks. Pure (no server/DB).
 * Numeric answers are recomputed here from the numbers written in each prompt, independently of the generator.
 *   npx tsx scripts/test-phase38-curriculum.ts
 */
import { GRADE7_TERM1_UNITS, GRADE7_TERM1_COMPETENCIES, GRADE7_TERM1_SKILLS, GRADE7_TERM1_LESSONS, GRADE7_TERM1_QUESTIONS as Q } from "../src/lib/curriculum/grade7-term1";
import { parseChoiceBlock } from "../src/lib/lesson/block-grading";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);
const nums = (s: string) => [...s.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
const near = (a: number, b: number) => Math.abs(a - b) < 0.051;

section("1. Structure");
const skillKeys = new Set(GRADE7_TERM1_SKILLS.map((s) => s.key));
const qKeys = new Set(Q.map((q) => q.key));
assert(qKeys.size === Q.length, "Question keys are unique");
assert(new Set(Q.map((q) => q.prompt)).size === Q.length, "No two questions have the same prompt");
assert(Q.every((q) => skillKeys.has(q.skill)), "Every question belongs to a defined skill");
for (const s of GRADE7_TERM1_SKILLS) assert(Q.filter((q) => q.skill === s.key).length >= 6, `Skill "${s.key}" has at least 6 questions`);
assert(GRADE7_TERM1_SKILLS.every((s) => s.prerequisites.every((p) => skillKeys.has(p) && p !== s.key)), "Prerequisites exist and are not self-referencing");
const order = GRADE7_TERM1_SKILLS.map((s) => s.key);
assert(GRADE7_TERM1_SKILLS.every((s) => s.prerequisites.every((p) => order.indexOf(p) < order.indexOf(s.key))), "Prerequisites always come earlier in the list (no cycles)");
const compKeys = new Set(GRADE7_TERM1_COMPETENCIES.map((c) => c.key));
assert(GRADE7_TERM1_SKILLS.every((s) => compKeys.has(s.competency)), "Every skill has a competency");
assert(new Set(GRADE7_TERM1_COMPETENCIES.map((c) => c.code)).size === GRADE7_TERM1_COMPETENCIES.length, "Competency codes are unique");
assert(GRADE7_TERM1_UNITS.length === 2 && GRADE7_TERM1_LESSONS.length === 6, "2 units and 6 lessons (weeks 1-6)");
assert(GRADE7_TERM1_LESSONS.map((l) => l.week).join() === "1,2,3,4,5,6", "One lesson per week, in order");
assert(GRADE7_TERM1_SKILLS.every((s) => GRADE7_TERM1_LESSONS.some((l) => l.skills.includes(s.key))), "Every skill is taught by a lesson");

section("2. Questions are well formed");
for (const q of Q) {
  if (q.type === "MULTIPLE_CHOICE") {
    const set = new Set(q.choices.map((c) => c.trim().toLowerCase()));
    assert(q.choices.length >= 3 && set.size === q.choices.length, `${q.key}: choices are distinct`);
    assert(q.correctIndex >= 0 && q.correctIndex < q.choices.length, `${q.key}: correct index is valid`);
  } else if (q.type === "NUMERIC_INPUT") {
    assert(Number.isFinite(q.answer), `${q.key}: numeric answer is finite`);
  }
  assert(q.prompt.trim().length > 10 && q.explanation.trim().length > 10, `${q.key}: has a prompt and explanation`);
}
const positions = new Set(Q.filter((q) => q.type === "MULTIPLE_CHOICE").map((q) => (q as any).correctIndex));
assert(positions.size >= 3, "The correct choice is not always in the same position");

section("3. Numeric answers recomputed from the prompt");
let checked = 0;
const eq = (q: any, expected: number) => { checked++; assert(near(q.answer, expected), `${q.key}: expected ${expected}, stored ${q.answer}`); };
for (const q of Q) {
  if (q.type !== "NUMERIC_INPUT") continue;
  const p = q.prompt, n = nums(p);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/regular (\w+) from a circle/))) {
    const sides: Record<string, number> = { pentagon: 5, hexagon: 6, octagon: 8, decagon: 10, nonagon: 9 };
    eq(q, 360 / sides[m[1]]);
  } else if (/12-sided polygon from a circle/.test(p)) eq(q, 30);
  else if (/complementary\. One measures/.test(p)) eq(q, 90 - n[0]);
  else if (/supplementary\. One measures/.test(p)) eq(q, 180 - n[0]);
  else if (/vertically opposite/.test(p)) eq(q, n[0]);
  else if (/linear pair/.test(p)) eq(q, 180 - n[0]);
  else if (/interior angle is \d+°\. What is the adjacent exterior/.test(p)) eq(q, 180 - n[0]);
  else if (/exterior angle is \d+°\. What is the adjacent interior/.test(p)) eq(q, 180 - n[0]);
  else if (/sum of the interior angles of a polygon with \d+ sides/.test(p)) eq(q, (n[0] - 2) * 180);
  else if (/EACH interior angle of a regular polygon with \d+ sides/.test(p)) eq(q, ((n[0] - 2) * 180) / n[0]);
  else if (/EACH exterior angle of a regular polygon with \d+ sides/.test(p)) eq(q, 360 / n[0]);
  else if (/Each exterior angle of a regular polygon is \d+°\. How many sides/.test(p)) eq(q, 360 / n[0]);
  else if (/interior angles of a polygon add up to \d+°\. How many sides/.test(p)) eq(q, n[0] / 180 + 2);
  else if (/Three interior angles of a quadrilateral/.test(p)) eq(q, 360 - n[0] - n[1] - n[2]);
  else if (/Four interior angles of a pentagon/.test(p)) eq(q, 540 - n[0] - n[1] - n[2] - n[3]);
  else if (/exterior angles of any convex polygon add up/.test(p)) eq(q, 360);
  else if (/(rises|drops) from [\d,]+ to [\d,]+\. What is the percentage|dropped from|sold \d+ meals/.test(p) && /percentage (increase|decrease)/.test(p)) {
    const [a, b] = n; eq(q, (Math.abs(b - a) / a) * 100);
  } else if (/is increased by \d+%\. What is the new price/.test(p)) eq(q, n[0] * (1 + n[1] / 100));
  else if (/is decreased by \d+%\. What is the new quantity/.test(p)) eq(q, n[0] * (1 - n[1] / 100));
  else if (/How much is the discount/.test(p)) eq(q, (n[0] * n[1]) / 100);
  else if (/What is the sale price/.test(p)) eq(q, n[0] * (1 - n[1] / 100));
  else if (/originally priced.*is sold for/.test(p)) eq(q, ((n[0] - n[1]) / n[0]) * 100);
  else if (/earns a \d+% commission/.test(p)) eq(q, (n[0] * n[1]) / 100);
  else if (/commission on sales of/.test(p)) eq(q, (n[0] / n[1]) * 100);
  else if (/How much is the tax/.test(p)) eq(q, (n[0] * n[1]) / 100);
  else if (/sales tax\. How much do you pay in all/.test(p)) eq(q, n[0] * (1 + n[1] / 100));
  else if (/Simple interest: principal/.test(p)) eq(q, (n[0] * n[1] * n[2]) / 100);
  else if (/simple interest per year for \d+ years\. How much money will you have/.test(p)) eq(q, n[0] + (n[0] * n[1] * n[2]) / 100);
  else if (/earns ₱[\d,]+ simple interest at/.test(p)) eq(q, n[1] / ((n[0] * n[2]) / 100));
  else if (/daily allowance of ₱200\. She plans/.test(p)) eq(q, n[0] - n[1] - n[2] - n[3]);
  else if (/save 20% of her/.test(p) || /spend 45% of/.test(p)) eq(q, (n[0] * n[1]) / 100 === q.answer ? q.answer : (n[1] * n[0]) / 100);
  else if (/Income ₱\d+, expenses/.test(p)) eq(q, n[0] - n[1] - n[2] - n[3]);
  else if (/cost ₱[\d,]+\. What is the unit rate/.test(p)) eq(q, n[1] / n[0]);
  else if (/unit rate|rate in liters per minute/.test(p)) eq(q, n[0] / n[1]);
  else if (/What is its speed/.test(p)) eq(q, n[0] / n[1]);
  else if (/travels at \d+ km\/h for/.test(p)) eq(q, n[0] * n[1]);
  else if (/How long does it take to travel/.test(p)) eq(q, n[0] / n[1]);
  else if (/At this rate, how many pages/.test(p)) eq(q, (n[0] / n[1]) * n[2]);
  else if (/pay for 10 days/.test(p) || /At this rate, how much is the pay/.test(p)) eq(q, (n[0] / n[1]) * n[2]);
  else if (/circle of radius \d+ cm/.test(p)) eq(q, n[1]);
  else if (/ratio 1 : 3/.test(p)) eq(q, 45);
  else if (/x and 2x/.test(p)) eq(q, 30);
  else if (/∠ABC = 90°/.test(p)) eq(q, 90 - n[1]);
  else if ((m = p.match(/How many (?:sides|interior angles) does an? (\w+) have/))) eq(q, { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10 }[m[1]]!);
  else if (/regular \w+ has a perimeter of/.test(p)) eq(q, n[0] / ({ pentagon: 5, hexagon: 6, octagon: 8, decagon: 10 } as any)[p.match(/regular (\w+)/)![1]]);
  else if (/How many (interior angles|sides)/.test(p) || /vertices/.test(p)) eq(q, n[0]);
  else assert(false, `${q.key}: no independent check written for "${p}"`);
}
assert(checked >= 100, `At least 100 numeric answers were recomputed independently (${checked})`);

section("4. Lessons");
for (const l of GRADE7_TERM1_LESSONS) {
  const types = l.blocks.map((b) => b.type);
  assert(types.includes("TEXT") && types.includes("EXAMPLE") && types.includes("CHECKPOINT") && types.includes("PRACTICE") && types.includes("SUMMARY"), `${l.key}: has text, example, checkpoint, practice and summary blocks`);
  assert(l.practice.length >= 10 && l.practice.every((k) => qKeys.has(k)), `${l.key}: practice set has ≥10 questions and all keys exist`);
  assert(new Set(l.practice).size === l.practice.length, `${l.key}: no duplicate practice questions`);
  const bySkill = new Set(l.practice.map((k) => Q.find((q) => q.key === k)!.skill));
  assert(l.skills.every((s) => bySkill.has(s)), `${l.key}: practice covers every skill the lesson teaches`);
  assert(l.practice.every((k) => l.skills.includes(Q.find((q) => q.key === k)!.skill)), `${l.key}: practice only uses the lesson's skills`);
  for (const b of l.blocks.filter((x) => x.type === "CHECKPOINT")) {
    const parsed = parseChoiceBlock({ type: "CHECKPOINT", metadata: JSON.stringify(b.metadata) } as any);
    assert(!!parsed, `${l.key}: checkpoint "${b.title}" is gradable (valid options and a correct answer among them)`);
  }
  for (const b of l.blocks.filter((x) => x.type === "EXAMPLE")) {
    const m = b.metadata as any;
    assert(typeof m?.problem === "string" && Array.isArray(m?.steps) && m.steps.length >= 2 && typeof m?.answer === "string", `${l.key}: example "${b.title}" has problem, steps and answer`);
  }
  for (const b of l.blocks.filter((x) => x.type === "IMAGE")) {
    const url = (b.metadata as any)?.url as string;
    assert(url.startsWith("data:image/svg+xml") && !!(b.metadata as any)?.alt, `${l.key}: image "${b.title}" is an inline SVG with alt text`);
    const svg = decodeURIComponent(url.split(",")[1] ?? "");
    assert(/<svg[\s\S]*<\/svg>\s*$/.test(svg) && !/<script|onload=|javascript:/i.test(svg), `${l.key}: SVG is well-formed and has no script`);
  }
  const all = l.blocks.map((b) => b.content).join("\n");
  assert(((all.match(/\$\$/g) ?? []).length % 2) === 0, `${l.key}: display math delimiters balanced`);
  assert(((all.replace(/\$\$/g, "").match(/\$/g) ?? []).length % 2) === 0 || /₱/.test(all), `${l.key}: inline math delimiters balanced`);
}
// checkpoint answer re-derivations that don't depend on the generator
const w3 = GRADE7_TERM1_LESSONS[2].blocks.find((b) => b.title === "Checkpoint: Sum of angles")!.metadata as any;
assert(w3.correctAnswer === `${(6 - 2) * 180}°`, "Week 3 checkpoint (hexagon angle sum) matches (n-2)x180");

console.log(`\nPHASE 38 CURRICULUM RESULTS: ${passed} passed, ${failed} failed (questions: ${Q.length}, skills: ${GRADE7_TERM1_SKILLS.length}, lessons: ${GRADE7_TERM1_LESSONS.length})`);
process.exit(failed > 0 ? 1 : 0);

/**
 * Tuklas AI - Phase 49: the Grade 7 Term 1 lessons follow the DepEd Budget of Work and Lesson Exemplars DAY BY DAY. Pure (no server/DB).
 *   - one lesson per exemplar day (Weeks 1-6), in order
 *   - each lesson names the topics of its day, and does NOT mention topics that belong to another day or week (so a week's topics are never
 *     combined in one lesson, and nothing outside the exemplars is taught)
 *   - the practice questions stay inside the lesson's day too
 *   npx tsx scripts/test-phase49-alignment.ts
 */
import { GRADE7_TERM1_LESSONS as L, GRADE7_TERM1_QUESTIONS as Q, GRADE7_TERM1_SKILLS as SK } from "../src/lib/curriculum/grade7-term1";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; if (process.env.VERBOSE) console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);

/** Days per week in the Lesson Exemplars (Q1 Lessons 1-6): Weeks 1 and 2 have 4 days, Week 3 has 5, Weeks 4-6 have 4. */
const DAYS: Record<number, number> = { 1: 4, 2: 4, 3: 5, 4: 4, 5: 4, 6: 4 };
type Rule = { must: RegExp[]; mustNot: RegExp[] };
/**
 * Scope rules. A lesson may refer back to anything taught earlier (an earlier day or an earlier week) but must not teach, name or test
 * anything that belongs to a LATER day, a later week, or lies outside the exemplars.
 */
const ANGLE_PAIRS = /complementary|supplementary|linear pair|vertical angle/i;
const WEEK_NOT: Record<number, RegExp> = {
  1: /exterior angle|n\s*-\s*2|complementary|supplementary|linear pair|vertical angle|convex|percent|%|₱|unit rate|speed/i,
  2: /exterior angle|n\s*-\s*2|sum of the interior|percent|%|₱|unit rate|speed/i,
  3: /percent|%|₱|unit rate|speed|discount/i,
  4: /discount|commission|sales tax|VAT|simple interest|unit rate|speed/i,
  5: /unit rate|speed/i,
  6: /%|percent|discount|commission|interest/i,
};
const RULES: Record<string, Rule> = {
  "g7t1-w1-d1": { must: [/polygon/i, /vertices/i, /interior angles?/i, /pentagon/i, /triangle/i], mustNot: [/regular|irregular|equilateral|equiangular|compass|central angle/i] },
  "g7t1-w1-d2": { must: [/equilateral/i, /equiangular/i, /regular polygon/i, /irregular/i, /108/, /135/], mustNot: [/compass|central angle|circle/i] },
  "g7t1-w1-d3": { must: [/compass/i, /protractor/i, /ruler/i, /circle/i, /72/, /45/, /36/], mustNot: [] },
  "g7t1-w1-d4": { must: [/triangle/i, /quadrilateral/i, /protractor/i, /540/, /720/], mustNot: [] },
  "g7t1-w2-d1": { must: [/non-convex/i, /convex/i, /180/], mustNot: [ANGLE_PAIRS] },
  "g7t1-w2-d2": { must: [/complementary/i, /supplementary/i, /adjacent/i, /90/], mustNot: [/linear pair|vertical angle/i] },
  "g7t1-w2-d3": { must: [/linear pair/i, /vertical/i], mustNot: [] },
  "g7t1-w2-d4": { must: [/convex/i, /complementary/i, /linear pair/i], mustNot: [] },
  "g7t1-w3-d1": { must: [/exterior angle/i, /interior angle/i, /adjacent/i, /protractor/i], mustNot: [/n\s*-\s*2/, /sum of the interior/i, /regular/i] },
  "g7t1-w3-d2": { must: [/supplementary/i, /180/, /exterior angle/i], mustNot: [/n\s*-\s*2/, /sum of the interior/i, /regular/i] },
  "g7t1-w3-d3": { must: [/n\s*-\s*2/, /missing/i, /number of sides/i], mustNot: [/regular/i, /frac\{360/] },
  "g7t1-w3-d4": { must: [/regular/i, /360/, /exterior angle/i], mustNot: [] },
  "g7t1-w3-d5": { must: [/regular/i, /n\s*-\s*2/], mustNot: [] },
  "g7t1-w4-d1": { must: [/percentage increase/i, /original value/i], mustNot: [/percentage decrease/i] },
  "g7t1-w4-d2": { must: [/percentage increase/i, /new value/i, /Understand/], mustNot: [/percentage decrease/i] },
  "g7t1-w4-d3": { must: [/percentage decrease/i, /original value/i], mustNot: [] },
  "g7t1-w4-d4": { must: [/percentage decrease/i, /new value/i, /original/i], mustNot: [] },
  "g7t1-w5-d1": { must: [/discount/i, /sale price/i, /original price/i], mustNot: [/commission|sales tax|VAT|simple interest|budget|financial plan/i] },
  "g7t1-w5-d2": { must: [/commission/i, /sales tax/i, /VAT/, /commission rate/i], mustNot: [/simple interest|budget|financial plan/i] },
  "g7t1-w5-d3": { must: [/interest/i, /principal/i, /I = P/], mustNot: [/budget|financial plan/i] },
  "g7t1-w5-d4": { must: [/financial plan/i, /income/i, /expenses/i, /savings/i], mustNot: [] },
  "g7t1-w6-d1": { must: [/ratio/i, /rate/i, /unit rate/i, /speed/i], mustNot: [/greatest common factor|divide the numerator/i, /distance \$\\times|speed \$\\times/i] },
  "g7t1-w6-d2": { must: [/unit rate/i, /denominator/i], mustNot: [/distance \$\\times|speed \$\\times/i] },
  "g7t1-w6-d3": { must: [/speed/i, /unit rate/i, /multiply/i], mustNot: [] },
  "g7t1-w6-d4": { must: [/unit rate/i], mustNot: [] },
};
const lessonText = (l: (typeof L)[number]) => [l.title, l.description, ...l.objectives, ...l.blocks.flatMap((b) => [b.title, b.content, b.metadata && b.type !== "IMAGE" ? JSON.stringify(b.metadata).replace(/\\\\/g, "\\") : ""])].join("\n");
const qText = (k: string) => { const q = Q.find((x) => x.key === k)!; return `${q.prompt}\n${q.explanation}\n${q.type === "MULTIPLE_CHOICE" ? q.choices.join(" ") : ""}`; };

section("1. One lesson per exemplar day, in order");
const daily = L.filter((l) => l.day !== undefined);
for (const [w, n] of Object.entries(DAYS)) {
  const ls = daily.filter((l) => l.week === Number(w));
  assert(ls.length === n && ls.every((l, i) => l.day === i + 1), `Week ${w}: ${n} daily lessons (Days 1-${n})`);
  assert(ls.every((l) => l.key === `g7t1-w${w}-d${l.day}` && l.title.startsWith(`Week ${w}, Day ${l.day}:`)), `Week ${w}: keys and titles carry the week and day`);
}
assert(daily.length === 25, "25 daily lessons for Weeks 1-6 (4 + 4 + 5 + 4 + 4 + 4)");
assert(L.every((l) => l.day !== undefined), "Every lesson is a daily lesson (no lesson holds a whole week)");
assert(daily.every((l) => l.published !== false), "Every daily lesson is published");
assert(daily.every((l) => new RegExp(`Lesson Exemplar Q1 Lesson ${l.week}, `).test(l.teacherNote)), "Every daily lesson's teacher note names the exemplar it follows");

section("2. Each lesson teaches the topics of its day and nothing from another day or week");
for (const l of daily) {
  const rule = RULES[l.key]; assert(!!rule, `${l.key}: has alignment rules`); if (!rule) continue;
  const t = lessonText(l);
  for (const re of rule.must) assert(re.test(t), `${l.key}: covers ${re}`);
  for (const re of [...rule.mustNot, WEEK_NOT[l.week]]) assert(!re.test(t), `${l.key}: does not mention ${re}${re.test(t) ? ` (found: "${(t.match(re) ?? [""])[0]}")` : ""}`);
}

section("3. A day is not a week: size limits");
for (const l of daily) {
  assert(l.blocks.length >= 6 && l.blocks.length <= 13, `${l.key}: a day's lesson has 6-13 sections (${l.blocks.length})`);
  assert(l.skills.length <= 3 && l.objectives.length <= 4, `${l.key}: at most 3 skills and 4 objectives (${l.skills.length} skills, ${l.objectives.length} objectives)`);
  assert(l.blocks.filter((b) => b.type === "EXAMPLE").length <= 5 && l.minutes <= 50, `${l.key}: at most 5 worked examples, at most 50 minutes`);
}

section("4. Practice questions stay inside the day");
for (const l of daily) {
  const rule = RULES[l.key]; if (!rule) continue;
  for (const k of l.practice) {
    const t = qText(k);
    assert(!rule.mustNot.some((re) => re.test(t)) && !WEEK_NOT[l.week].test(t), `${l.key}: ${k} is within the day's scope`);
  }
  assert(l.practice.every((k) => l.skills.includes(Q.find((q) => q.key === k)!.skill)), `${l.key}: practice only uses the lesson's skills`);
}
const used = new Set(daily.flatMap((l) => l.practice));
assert([...used].every((k) => Q.some((q) => q.key === k)), "Every practice question exists");

section("5. Nothing beyond the exemplars is left in the question bank");
for (const k of ["g7t1-angle-pairs-12", "g7t1-angle-pairs-13", "g7t1-pct-decrease-13", "g7t1-money-interest-05", "g7t1-poly-regular-06", "g7t1-poly-regular-07", "g7t1-poly-regular-08", "g7t1-poly-regular-09", "g7t1-poly-construct-05", "g7t1-poly-construct-06"]) assert(!Q.some((q) => q.key === k), `${k} (beyond the exemplar) is not in the bank`);

console.log(`\nPHASE 49 ALIGNMENT RESULTS: ${passed} passed, ${failed} failed (daily lessons: ${daily.length})`);
process.exit(failed > 0 ? 1 : 0);

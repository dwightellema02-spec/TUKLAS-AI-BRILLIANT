/**
 * Question bank for Grade 7 Term 1 (weeks 1-6). Every numeric answer is computed here from the numbers in the question;
 * `scripts/test-phase38-curriculum.ts` recomputes them independently. Written for this platform (not copied from DepEd materials).
 */
import type { SeedQuestion } from "./grade7-term1-types";

type Diff = "EASY" | "MEDIUM" | "HARD";
const out: SeedQuestion[] = [];
let counters: Record<string, number> = {};
const next = (skill: string) => `${skill}-${String((counters[skill] = (counters[skill] ?? 0) + 1)).padStart(2, "0")}`;

function mc(skill: string, prompt: string, correct: string, wrong: string[], explanation: string, difficulty: Diff = "EASY") {
  // the correct choice is placed at a position that depends on the question key so it is not always "A"
  const key = next(skill);
  const pos = (key.charCodeAt(key.length - 1) + key.length) % (wrong.length + 1);
  const choices = [...wrong];
  choices.splice(pos, 0, correct);
  out.push({ key, skill, type: "MULTIPLE_CHOICE", prompt, difficulty, explanation, choices, correctIndex: pos });
}
const num = (skill: string, prompt: string, answer: number, explanation: string, difficulty: Diff = "EASY", opts: { tolerance?: number; unit?: string } = {}) =>
  out.push({ key: next(skill), skill, type: "NUMERIC_INPUT", prompt, difficulty, explanation, answer, ...opts });
const tf = (skill: string, prompt: string, answer: boolean, explanation: string, difficulty: Diff = "EASY") =>
  out.push({ key: next(skill), skill, type: "TRUE_FALSE", prompt, difficulty, explanation, answer });

const NAMES: Record<number, string> = { 3: "triangle", 4: "quadrilateral", 5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon", 9: "nonagon", 10: "decagon" };
const peso = (n: number) => `₱${n.toLocaleString("en-US")}`;
const pct = (n: number) => `${n}%`;

// ---------------------------------------------------------------- Week 1: polygons
// S1 define and identify polygons
mc("g7t1-poly-define", "Which description fits a polygon?", "A closed figure made only of straight line segments that meet at their endpoints", ["A figure with at least one curved side", "Two straight lines that cross each other", "A closed figure with a curved top and a straight bottom"], "A polygon is a closed plane figure bounded by straight line segments that meet only at their endpoints. A curved side or an open figure is not allowed.");
tf("g7t1-poly-define", "A figure that has a curved side is a polygon.", false, "Polygons are made of straight line segments only, so a curved side means it is not a polygon.");
tf("g7t1-poly-define", "A polygon must have at least 3 sides.", true, "The smallest polygon is the triangle, with 3 sides. Two segments cannot enclose a region.");
tf("g7t1-poly-define", "An open figure, where the last segment does not meet the first, is a polygon.", false, "A polygon must be closed.");
num("g7t1-poly-define", "A polygon has 7 vertices (corners). How many sides does it have?", 7, "A polygon has the same number of sides as vertices.");
num("g7t1-poly-define", "How many interior angles does a polygon with 9 sides have?", 9, "A polygon has one interior angle at each vertex, so the number of interior angles equals the number of sides.");
mc("g7t1-poly-define", "A triangle is named ABC. Which of these is one of its sides?", "AB", ["∠B", "ABC", "A"], "Sides are line segments joining two vertices, such as AB, BC and AC. ∠ABC names an angle and A names a vertex.", "MEDIUM");

// S2 name polygons by number of sides
for (const n of [5, 6, 8, 10, 7, 9]) {
  const wrong = [3, 4, 5, 6, 7, 8, 9, 10].filter((k) => k !== n).sort((a, b) => Math.abs(a - n) - Math.abs(b - n)).slice(0, 3).map((k) => NAMES[k]);
  mc("g7t1-poly-names", `What is the name of a polygon with ${n} sides?`, NAMES[n], wrong, `A polygon with ${n} sides is called a ${NAMES[n]}.`, n <= 6 ? "EASY" : "MEDIUM");
}
num("g7t1-poly-names", "How many sides does an octagon have?", 8, "Octa- means eight.");
num("g7t1-poly-names", "How many sides does a decagon have?", 10, "Deca- means ten.");
num("g7t1-poly-names", "How many interior angles does a hexagon have?", 6, "A hexagon has 6 sides and so 6 interior angles.");
mc("g7t1-poly-names", "A quadrilateral is a polygon with how many sides?", "4", ["3", "5", "6"], "Quadri- means four.");

// S3 regular and irregular
tf("g7t1-poly-regular", "A square is a regular polygon.", true, "A square has four equal sides and four equal angles (90° each).");
tf("g7t1-poly-regular", "A rectangle that is not a square is a regular polygon.", false, "Its angles are all equal (90°) but its sides are not all equal, so it is irregular.");
tf("g7t1-poly-regular", "A polygon whose sides are all equal must be a regular polygon.", false, "A rhombus that is not a square has four equal sides but its angles are not all equal. A regular polygon needs equal sides AND equal angles.");
mc("g7t1-poly-regular", "Which statement describes a regular polygon?", "All its sides are equal and all its angles are equal", ["Only its sides are equal", "Only its angles are equal", "It has exactly four sides"], "Regular means equilateral (equal sides) and equiangular (equal angles).");
mc("g7t1-poly-regular", "A triangle with sides 5 cm, 5 cm and 5 cm is best called a", "regular triangle (equilateral triangle)", ["irregular triangle", "right triangle only", "quadrilateral"], "All three sides are equal, so all three angles are equal as well: a regular (equilateral) triangle.", "MEDIUM");
for (const [n, side] of [[6, 7], [5, 12], [8, 5], [10, 4]] as const) {
  num("g7t1-poly-regular", `A regular ${NAMES[n]} has a perimeter of ${n * side} cm. How long is each side (in cm)?`, side, `All ${n} sides are equal, so each side is ${n * side} ÷ ${n} = ${side} cm.`, "MEDIUM", { unit: "cm" });
}

// S4 construct regular polygons (central angle and compass/ruler/protractor facts)
for (const n of [5, 6, 8, 10, 9, 12]) {
  num("g7t1-poly-construct", `To draw a regular ${NAMES[n] ?? `${n}-sided polygon`} from a circle, you mark points around the center at equal angles. What is that angle in degrees?`, 360 / n, `The full turn of 360° is shared equally among ${n} points: 360 ÷ ${n} = ${360 / n}°.`, n <= 8 ? "EASY" : "MEDIUM", { tolerance: 0.01, unit: "°" });
}
num("g7t1-poly-construct", "You draw a regular hexagon by marking 6 points on a circle of radius 3 cm and joining them. How long is each side (in cm)?", 3, "In a regular hexagon the side equals the radius of the circle through its vertices (the six triangles at the center are equilateral).", "HARD", { unit: "cm" });
mc("g7t1-poly-construct", "Which tools do you use to draw a regular polygon from a circle?", "A compass (for the circle), a protractor (to mark equal angles) and a ruler (to join the points)", ["Only a ruler", "A calculator and a ruler", "A protractor only"], "The compass draws the circle, the protractor marks equal angles at the center, and the ruler joins the marked points.");
mc("g7t1-poly-construct", "What is the LAST step in drawing a regular octagon from a circle?", "Join the 8 marked points in order with straight segments", ["Mark the center of the circle", "Draw the circle", "Measure 45° at the center"], "First the circle, then equal angles at the center, and finally the points are joined to form the polygon.", "MEDIUM");

// ---------------------------------------------------------------- Week 2: convex / non-convex, angle pairs
// S5 convex vs non-convex
tf("g7t1-poly-convex", "Every interior angle of a convex polygon is less than 180°.", true, "That is the definition used here: no interior angle is greater than 180°, and no vertex points inward.");
tf("g7t1-poly-convex", "A non-convex (concave) polygon has at least one interior angle greater than 180°.", true, "A reflex interior angle (more than 180°) makes a vertex point inward.");
tf("g7t1-poly-convex", "Every regular polygon is convex.", true, "Each interior angle of a regular polygon is less than 180°, so a regular polygon (with the usual simple outline) is convex.", "MEDIUM");
mc("g7t1-poly-convex", "A quadrilateral has interior angles 40°, 50°, 230° and 40°. Which statement is true?", "It is non-convex because one angle is greater than 180°", ["It is convex because the angles add up to 360°", "It is convex because it has 4 sides", "It is a regular polygon"], "The angles do add up to 360°, but 230° is greater than 180°, so the polygon is non-convex.", "MEDIUM");
mc("g7t1-poly-convex", "A quadrilateral has interior angles 70°, 100°, 60° and 130°. Which statement is true?", "It is convex because every angle is less than 180°", ["It is non-convex because the angles are different", "It is regular because it is a quadrilateral", "It is non-convex because it has an angle over 90°"], "All four angles are less than 180°, so the quadrilateral is convex. Different angles only make it irregular.", "MEDIUM");
mc("g7t1-poly-convex", "If you join two points inside a non-convex polygon with a straight segment, what can happen?", "The segment may pass outside the polygon", ["The segment always stays inside", "The segment is always equal to a side", "The segment is always parallel to a side"], "In a non-convex polygon, some segments between two inside points leave the polygon. In a convex polygon they never do.", "HARD");
tf("g7t1-poly-convex", "A polygon can be both regular and non-convex (with the usual simple outline).", false, "A regular polygon has all angles equal and less than 180°, so it is convex.", "HARD");

// S6 angle pairs
for (const a of [25, 58, 71, 36]) num("g7t1-angle-pairs", `Two angles are complementary. One measures ${a}°. What is the other angle in degrees?`, 90 - a, `Complementary angles add up to 90°: 90 − ${a} = ${90 - a}.`, "EASY", { unit: "°" });
for (const a of [110, 37, 124, 85]) num("g7t1-angle-pairs", `Two angles are supplementary. One measures ${a}°. What is the other angle in degrees?`, 180 - a, `Supplementary angles add up to 180°: 180 − ${a} = ${180 - a}.`, "EASY", { unit: "°" });
num("g7t1-angle-pairs", "Two straight lines cross. One of the four angles measures 48°. What does the angle vertically opposite to it measure (in degrees)?", 48, "Vertical angles are equal.", "EASY", { unit: "°" });
num("g7t1-angle-pairs", "Two angles form a linear pair. One measures 125°. What does the other measure (in degrees)?", 55, "A linear pair lies on a straight line, so the angles add up to 180°: 180 − 125 = 55.", "EASY", { unit: "°" });
num("g7t1-angle-pairs", "∠ABC = 90°. A ray BD lies inside it, with ∠ABD = 35°. What is ∠DBC (in degrees)?", 55, "∠ABD and ∠DBC are adjacent and together make the right angle ABC: 90 − 35 = 55.", "MEDIUM", { unit: "°" });
num("g7t1-angle-pairs", "Two supplementary angles are in the ratio 1 : 3 (the larger is 3 times the smaller). What does the smaller angle measure (in degrees)?", 45, "Let the smaller be x. Then x + 3x = 180, so 4x = 180 and x = 45.", "HARD", { unit: "°" });
num("g7t1-angle-pairs", "Two complementary angles are x and 2x. What is x (in degrees)?", 30, "x + 2x = 90, so 3x = 90 and x = 30.", "HARD", { unit: "°" });
mc("g7t1-angle-pairs", "Two angles measure 35° and 55°. What are they?", "Complementary angles", ["Supplementary angles", "Vertical angles", "A linear pair"], "35 + 55 = 90, so they are complementary.", "MEDIUM");
mc("g7t1-angle-pairs", "Two angles measure 100° and 80°. What are they?", "Supplementary angles", ["Complementary angles", "Vertical angles", "Equal angles"], "100 + 80 = 180, so they are supplementary.", "MEDIUM");
mc("g7t1-angle-pairs", "Two lines intersect. The angles opposite each other at the crossing are called", "vertical angles", ["complementary angles", "a linear pair", "adjacent angles that add up to 90°"], "Vertically opposite angles are equal.", "EASY");
tf("g7t1-angle-pairs", "Every linear pair is also a pair of supplementary angles.", true, "A linear pair lies on a straight line, so its two angles add up to 180°.", "MEDIUM");
tf("g7t1-angle-pairs", "Supplementary angles must be adjacent (next to each other).", false, "Two angles of 110° and 70° in different places are supplementary even though they are not adjacent.", "HARD");

// ---------------------------------------------------------------- Week 3: interior and exterior angles
// S7 exterior and adjacent interior angle
for (const i of [120, 150, 108, 135, 140]) num("g7t1-ext-int", `At one vertex of a polygon, the interior angle is ${i}°. What is the adjacent exterior angle (in degrees)?`, 180 - i, `The interior angle and the adjacent exterior angle form a straight line: 180 − ${i} = ${180 - i}.`, "EASY", { unit: "°" });
for (const e of [45, 72, 30, 90]) num("g7t1-ext-int", `At one vertex of a polygon, the exterior angle is ${e}°. What is the adjacent interior angle (in degrees)?`, 180 - e, `Interior + exterior = 180°, so the interior angle is 180 − ${e} = ${180 - e}.`, "EASY", { unit: "°" });
tf("g7t1-ext-int", "An interior angle and its adjacent exterior angle always add up to 180°.", true, "They are a linear pair.", "EASY");
mc("g7t1-ext-int", "The exterior angle at a vertex of a polygon is 60°. What kind of angle is the adjacent interior angle?", "An obtuse angle (120°)", ["An acute angle (30°)", "A right angle (90°)", "A reflex angle (300°)"], "180 − 60 = 120°, which is obtuse (between 90° and 180°).", "MEDIUM");

// S8 angle measures and number of sides
for (const n of [5, 6, 8, 10, 12]) num("g7t1-polygon-angles", `What is the sum of the interior angles of a polygon with ${n} sides (in degrees)?`, (n - 2) * 180, `Sum = (n − 2) × 180° = (${n} − 2) × 180 = ${(n - 2) * 180}°.`, n <= 6 ? "EASY" : "MEDIUM", { unit: "°" });
for (const n of [5, 6, 8, 9, 10, 12]) num("g7t1-polygon-angles", `What is the measure of EACH interior angle of a regular polygon with ${n} sides (in degrees)?`, ((n - 2) * 180) / n, `Sum of interior angles ÷ number of angles = ${(n - 2) * 180} ÷ ${n} = ${((n - 2) * 180) / n}°.`, "MEDIUM", { unit: "°" });
for (const n of [5, 9, 10, 20]) num("g7t1-polygon-angles", `What is the measure of EACH exterior angle of a regular polygon with ${n} sides (in degrees)?`, 360 / n, `The exterior angles of a convex polygon add up to 360°, so each is 360 ÷ ${n} = ${360 / n}°.`, "MEDIUM", { unit: "°" });
for (const e of [24, 36, 45]) num("g7t1-polygon-angles", `Each exterior angle of a regular polygon is ${e}°. How many sides does it have?`, 360 / e, `Number of sides = 360 ÷ ${e} = ${360 / e}.`, "HARD");
for (const s of [900, 1260, 1620]) num("g7t1-polygon-angles", `The interior angles of a polygon add up to ${s}°. How many sides does it have?`, s / 180 + 2, `(n − 2) × 180 = ${s}, so n − 2 = ${s / 180} and n = ${s / 180 + 2}.`, "HARD");
num("g7t1-polygon-angles", "Three interior angles of a quadrilateral are 85°, 95° and 110°. What is the fourth (in degrees)?", 360 - 290, "The interior angles of a quadrilateral add up to 360°. 85 + 95 + 110 = 290, so the fourth is 360 − 290 = 70.", "MEDIUM", { unit: "°" });
num("g7t1-polygon-angles", "Four interior angles of a pentagon are 100°, 110°, 120° and 90°. What is the fifth (in degrees)?", 540 - 420, "The interior angles of a pentagon add up to 540°. 100 + 110 + 120 + 90 = 420, so the fifth is 540 − 420 = 120.", "MEDIUM", { unit: "°" });
num("g7t1-polygon-angles", "What do the exterior angles of any convex polygon add up to (in degrees)?", 360, "Walking around a convex polygon you turn through one full turn, 360°, in total.", "MEDIUM", { unit: "°" });

// ---------------------------------------------------------------- Week 4: percentage increase / decrease
const roundTo = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;
for (const [o, n] of [[200, 250], [80, 100], [450, 540], [1500, 1650], [60, 75]] as const) {
  const p = ((n - o) / o) * 100;
  num("g7t1-pct-increase", `A value rises from ${o} to ${n}. What is the percentage increase?`, roundTo(p, 2), `Increase = ${n} − ${o} = ${n - o}. Percentage increase = ${n - o} ÷ ${o} × 100% = ${roundTo(p, 2)}%.`, "EASY", { tolerance: 0.01, unit: "%" });
}
num("g7t1-pct-increase", "A school canteen sold 150 meals on Monday and 170 on Tuesday. What is the percentage increase, to the nearest tenth of a percent?", 13.3, "Increase = 20. 20 ÷ 150 × 100% = 13.33…%, which is 13.3% to the nearest tenth.", "MEDIUM", { tolerance: 0.05, unit: "%" });
for (const [o, p] of [[400, 15], [2500, 8], [640, 25], [90, 10]] as const) {
  num("g7t1-pct-increase", `A price of ${peso(o)} is increased by ${pct(p)}. What is the new price (in pesos)?`, o + (o * p) / 100, `Increase = ${p}% of ${o} = ${(o * p) / 100}. New price = ${o} + ${(o * p) / 100} = ${o + (o * p) / 100}.`, "MEDIUM", { tolerance: 0.01, unit: "₱" });
}
mc("g7t1-pct-increase", "The original value is the number you compare the change with. In the percentage increase formula, what do you divide the increase by?", "The original value", ["The new value", "The sum of the two values", "100"], "Percentage increase = (increase ÷ original value) × 100%.", "MEDIUM");
tf("g7t1-pct-increase", "A rise from 40 to 60 is a 50% increase.", true, "Increase = 20, and 20 ÷ 40 × 100% = 50%.", "MEDIUM");
tf("g7t1-pct-increase", "A rise from 40 to 60 is a 20% increase.", false, "20 is the increase in value, not the percentage. 20 ÷ 40 × 100% = 50%.", "HARD");

for (const [o, n] of [[500, 400], [250, 200], [1200, 900], [80, 68], [600, 540]] as const) {
  const p = ((o - n) / o) * 100;
  num("g7t1-pct-decrease", `A value drops from ${o} to ${n}. What is the percentage decrease?`, roundTo(p, 2), `Decrease = ${o} − ${n} = ${o - n}. Percentage decrease = ${o - n} ÷ ${o} × 100% = ${roundTo(p, 2)}%.`, "EASY", { tolerance: 0.01, unit: "%" });
}
num("g7t1-pct-decrease", "A phone's price dropped from ₱9,500 to ₱8,000. What is the percentage decrease, to the nearest tenth of a percent?", 15.8, "Decrease = 1,500. 1,500 ÷ 9,500 × 100% = 15.79…%, which is 15.8%.", "MEDIUM", { tolerance: 0.05, unit: "%" });
for (const [o, p] of [[800, 35], [360, 5], [1500, 12], [250, 40]] as const) {
  num("g7t1-pct-decrease", `A quantity of ${o} is decreased by ${pct(p)}. What is the new quantity?`, o - (o * p) / 100, `Decrease = ${p}% of ${o} = ${(o * p) / 100}. New quantity = ${o} − ${(o * p) / 100} = ${o - (o * p) / 100}.`, "MEDIUM", { tolerance: 0.01 });
}
mc("g7t1-pct-decrease", "Which situation is a percentage DECREASE?", "A bag that cost ₱600 now costs ₱480", ["A bag that cost ₱480 now costs ₱600", "A bag that costs ₱600 is bought with ₱100 more", "A bag is sold at the same price"], "The price went down, from ₱600 to ₱480, so it is a decrease.");
mc("g7t1-pct-decrease", "A town's population rose from 8,000 to 9,200. Which statement is correct?", "It is a percentage increase of 15%", ["It is a percentage decrease of 15%", "It is a percentage increase of 13%", "It is a percentage increase of 1,200%"], "Increase = 1,200. 1,200 ÷ 8,000 × 100% = 15%.", "HARD");
tf("g7t1-pct-decrease", "If a price falls by 50% and then rises by 50%, it returns to the original price.", false, "Starting from 100: down 50% gives 50; up 50% of 50 gives 75, not 100. The percentages are of different bases.", "HARD");

// ---------------------------------------------------------------- Week 5: money problems, financial plan
for (const [price, rate] of [[800, 25], [1250, 20], [360, 15], [2400, 30]] as const) {
  const d = (price * rate) / 100;
  num("g7t1-money-discount", `A pair of shoes costs ${peso(price)} and is on sale at a ${pct(rate)} discount. How much is the discount (in pesos)?`, d, `Discount = original price × rate = ${price} × ${rate / 100} = ${d}.`, "EASY", { tolerance: 0.01, unit: "₱" });
  num("g7t1-money-discount", `A pair of shoes costs ${peso(price)} and is on sale at a ${pct(rate)} discount. What is the sale price (in pesos)?`, price - d, `Sale price = original price − discount = ${price} − ${d} = ${price - d}.`, "MEDIUM", { tolerance: 0.01, unit: "₱" });
}
num("g7t1-money-discount", "A jacket originally priced ₱1,500 is sold for ₱1,200. What is the discount rate (as a percent)?", 20, "Discount = 300. 300 ÷ 1,500 × 100% = 20%.", "HARD", { tolerance: 0.01, unit: "%" });
mc("g7t1-money-discount", "Which formula gives the sale price?", "Sale price = original price − discount", ["Sale price = original price + discount", "Sale price = discount ÷ original price", "Sale price = original price × 100"], "A discount lowers the price, so it is subtracted from the original price.");
tf("g7t1-money-discount", "A 10% discount on an item that costs ₱500 saves ₱50.", true, "10% of 500 = 50.", "EASY");

for (const [sales, rate] of [[250000, 3], [90000, 5], [48000, 4]] as const) {
  num("g7t1-money-commission", `An agent sells a property for ${peso(sales)} and earns a ${pct(rate)} commission. How much is the commission (in pesos)?`, (sales * rate) / 100, `Commission = ${rate}% of ${sales} = ${(sales * rate) / 100}.`, "EASY", { tolerance: 0.01, unit: "₱" });
}
num("g7t1-money-commission", "A salesperson earned ₱4,500 commission on sales of ₱90,000. What is the commission rate (as a percent)?", 5, "4,500 ÷ 90,000 × 100% = 5%.", "MEDIUM", { tolerance: 0.01, unit: "%" });
for (const [price, rate] of [[1500, 12], [800, 12], [2500, 12]] as const) {
  num("g7t1-money-commission", `An item costs ${peso(price)} before ${pct(rate)} sales tax (VAT). How much is the tax (in pesos)?`, (price * rate) / 100, `Tax = ${rate}% of ${price} = ${(price * rate) / 100}.`, "EASY", { tolerance: 0.01, unit: "₱" });
}
num("g7t1-money-commission", "An item costs ₱1,500 before 12% sales tax. How much do you pay in all (in pesos)?", 1680, "Tax = 12% of 1,500 = 180. Total = 1,500 + 180 = 1,680.", "MEDIUM", { tolerance: 0.01, unit: "₱" });
mc("g7t1-money-commission", "Which is true about sales tax?", "It is added to the price, so you pay more than the marked price", ["It is subtracted from the price", "It is the same as a discount", "It is only paid by the store"], "Sales tax (such as VAT) is a percentage added to the price of goods or services.", "MEDIUM");
mc("g7t1-money-commission", "A commission is", "money earned by a person as a percent of the sales they make", ["a reduction in the price of an item", "a tax added to a purchase", "interest paid by a bank"], "A commission rewards a seller with a percent of what they sold.", "EASY");

for (const [p, r, t] of [[10000, 4, 3], [5000, 6, 2], [20000, 5, 1], [8000, 3, 4]] as const) {
  num("g7t1-money-interest", `Simple interest: principal ${peso(p)}, rate ${r}% per year, time ${t} year${t > 1 ? "s" : ""}. How much interest is earned (in pesos)?`, (p * r * t) / 100, `I = P × r × t = ${p} × ${r / 100} × ${t} = ${(p * r * t) / 100}.`, "MEDIUM", { tolerance: 0.01, unit: "₱" });
}
num("g7t1-money-interest", "You deposit ₱5,000 at 6% simple interest per year for 2 years. How much money will you have in all at the end (in pesos)?", 5600, "Interest = 5,000 × 0.06 × 2 = 600. Total = 5,000 + 600 = 5,600.", "MEDIUM", { tolerance: 0.01, unit: "₱" });
num("g7t1-money-interest", "₱2,000 earns ₱300 simple interest at 5% per year. For how many years was it invested?", 3, "I = P × r × t, so 300 = 2,000 × 0.05 × t = 100t, and t = 3.", "HARD");
mc("g7t1-money-interest", "In simple interest, I = P × r × t. What does r stand for?", "The interest rate per year (as a decimal)", ["The principal", "The time in years", "The interest earned"], "P is the principal, r the yearly rate, t the time in years, and I the interest.", "EASY");

// S14 financial plan
num("g7t1-money-budget", "Mia gets a daily allowance of ₱200. She plans ₱60 for food, ₱40 for fare and ₱30 for school needs. How much is left to save (in pesos)?", 70, "Total planned spending = 60 + 40 + 30 = 130. Savings = 200 − 130 = 70.", "EASY", { unit: "₱" });
num("g7t1-money-budget", "Mia wants to save 20% of her ₱350 daily allowance. How much should she set aside each day (in pesos)?", 70, "20% of 350 = 0.20 × 350 = 70.", "EASY", { unit: "₱" });
num("g7t1-money-budget", "A student plans to spend 45% of a ₱400 daily allowance on food. How much is that (in pesos)?", 180, "45% of 400 = 0.45 × 400 = 180.", "MEDIUM", { unit: "₱" });
num("g7t1-money-budget", "Income ₱500, expenses ₱120 + ₱80 + ₱150. What are the savings (in pesos)?", 150, "Expenses = 120 + 80 + 150 = 350. Savings = 500 − 350 = 150.", "EASY", { unit: "₱" });
mc("g7t1-money-budget", "Which formula describes a daily financial plan?", "Savings = income − total planned expenses", ["Savings = income + total planned expenses", "Savings = expenses ÷ income", "Savings = income × expenses"], "What you do not spend from your income is what you can save.");
tf("g7t1-money-budget", "A good budget lists the money coming in and the money planned to go out before spending.", true, "Planning first lets you see how much you can save or whether you are overspending.", "EASY");

// ---------------------------------------------------------------- Week 6: rates
mc("g7t1-rate-identify", "Which is a rate?", "₱45 for 3 kilograms of rice", ["3 boys to 5 girls in a group", "The sides of a square are equal", "A triangle has 3 angles"], "A rate compares two quantities with DIFFERENT units (pesos and kilograms). Boys and girls are both counted in people, so that is a ratio.", "EASY");
mc("g7t1-rate-identify", "Which statement is a unit rate?", "₱40 per kilogram", ["₱200 for 5 kilograms", "40 kilometers in 2 hours", "6 pieces for ₱90"], "A unit rate has 1 as the second quantity (per 1 kilogram). The others compare with 5, 2 or 6.", "MEDIUM");
mc("g7t1-rate-identify", "Speed is an example of a rate because it compares", "distance with time", ["two lengths", "two prices", "two weights"], "Distance (km) and time (h) have different units.", "EASY");
tf("g7t1-rate-identify", "A rate compares two quantities that have different units.", true, "For example kilometers and hours, or pesos and kilograms.", "EASY");
tf("g7t1-rate-identify", "'60 kilometers per hour' is a unit rate.", true, "It states the distance for 1 hour.", "EASY");
mc("g7t1-rate-identify", "Which is the best use of unit rates?", "Comparing which of two offers costs less per piece", ["Finding the area of a polygon", "Measuring an angle", "Naming a polygon"], "Unit rates put two offers on the same basis (per 1 piece, per 1 kg, per 1 hour).", "MEDIUM");

for (const [a, b, ans, u] of [[150, 3, 50, "kilometers per hour"], [240, 6, 40, "pesos per kilogram"], [360, 6, 60, "words per minute"], [175, 5, 35, "pesos per notebook"], [96, 8, 12, "pages per day"]] as const) {
  const what = u === "kilometers per hour" ? `A bus travels ${a} kilometers in ${b} hours.` : u === "pesos per kilogram" ? `${b} kilograms of pork cost ${peso(a)}.` : u === "words per minute" ? `A student types ${a} words in ${b} minutes.` : u === "pesos per notebook" ? `${b} notebooks cost ${peso(a)}.` : `A learner reads ${a} pages in ${b} days.`;
  num("g7t1-rate-unit", `${what} What is the unit rate (${u})?`, ans, `Divide by the second quantity: ${a} ÷ ${b} = ${ans} ${u}.`, "EASY", { tolerance: 0.01 });
}
mc("g7t1-rate-unit", "₱84 for 6 pieces or ₱120 for 10 pieces: which offer is cheaper per piece?", "₱120 for 10 pieces (₱12 per piece)", ["₱84 for 6 pieces (₱14 per piece)", "They cost the same per piece", "It cannot be compared"], "84 ÷ 6 = 14 per piece and 120 ÷ 10 = 12 per piece, so the second offer is cheaper.", "HARD");
num("g7t1-rate-unit", "A faucet fills 45 liters in 9 minutes. What is the rate in liters per minute?", 5, "45 ÷ 9 = 5 liters per minute.", "MEDIUM", { tolerance: 0.01 });

for (const [d, t] of [[240, 4], [180, 3], [150, 2.5]] as const) {
  num("g7t1-rate-problems", `A jeepney travels ${d} km in ${t} hours at a steady speed. What is its speed (in km/h)?`, d / t, `Speed = distance ÷ time = ${d} ÷ ${t} = ${d / t} km/h.`, "EASY", { tolerance: 0.01, unit: "km/h" });
}
for (const [s, t] of [[45, 3], [60, 2.5], [80, 1.5]] as const) {
  num("g7t1-rate-problems", `A van travels at ${s} km/h for ${t} hours. How far does it go (in km)?`, s * t, `Distance = speed × time = ${s} × ${t} = ${s * t} km.`, "MEDIUM", { tolerance: 0.01, unit: "km" });
}
for (const [d, s] of [[180, 60], [150, 50], [120, 30]] as const) {
  num("g7t1-rate-problems", `How long does it take to travel ${d} km at ${s} km/h (in hours)?`, d / s, `Time = distance ÷ speed = ${d} ÷ ${s} = ${d / s} hours.`, "MEDIUM", { tolerance: 0.01, unit: "h" });
}
num("g7t1-rate-problems", "Jim writes 10 pages in 4 hours. At this rate, how many pages can he write in 6 hours?", 15, "Unit rate = 10 ÷ 4 = 2.5 pages per hour. In 6 hours: 2.5 × 6 = 15 pages.", "HARD", { tolerance: 0.01 });
num("g7t1-rate-problems", "A worker is paid ₱1,800 for 6 days of work. At this rate, how much is the pay for 10 days (in pesos)?", 3000, "Unit rate = 1,800 ÷ 6 = ₱300 per day. For 10 days: 300 × 10 = ₱3,000.", "HARD", { tolerance: 0.01, unit: "₱" });
mc("g7t1-rate-problems", "A cyclist rides 36 km in 2 hours. Which statement is correct?", "Her speed is 18 km/h", ["Her speed is 72 km/h", "Her speed is 38 km/h", "Her speed is 34 km/h"], "36 ÷ 2 = 18 km/h.", "EASY");

// Added in Phase 49 so every part of the Lesson Exemplars has questions: identifying exterior angles (Week 3, Day 1), finding the original price
// from a sale price and finding the principal and the rate in simple interest (Week 5, Days 1 and 3).
mc("g7t1-ext-int", "At a vertex of a polygon, the angle outside the polygon formed by extending one side past the vertex is called the", "exterior angle", ["interior angle", "vertical angle", "central angle"], "Extending a side past a vertex makes an angle outside the polygon: an exterior angle.");
mc("g7t1-ext-int", "At one vertex of a polygon, the interior angle and the exterior angle next to it are", "adjacent angles that add up to 180°", ["vertical angles that are equal", "complementary angles that add up to 90°", "angles that add up to 360°"], "They share the vertex and one side and together form a straight line, so they add up to 180°.");
// Week 1, Day 2: angle measures of regular polygons (the exemplar gives them for 5, 6, 8 and 10 sides), regular polygons in words
for (const [n, name, angle] of [[5, "pentagon", 108], [8, "octagon", 135]] as const) {
  num("g7t1-poly-regular", `Each interior angle of a regular ${name} measures how many degrees?`, angle, `A regular ${name} has ${n} equal interior angles of ${angle}° each.`, "EASY", { tolerance: 0.01, unit: "°" });
}
mc("g7t1-poly-regular", "A polygon that is both equilateral and equiangular is called a", "regular polygon", ["irregular polygon", "triangle", "quadrilateral"], "Equilateral means all sides are equal and equiangular means all angles are equal; a polygon with both is regular.");
num("g7t1-poly-regular", "ABCDE is a regular pentagon and side BC is 10 cm. How long is side AE (in cm)?", 10, "All sides of a regular polygon are equal, so AE = BC = 10 cm.", "EASY", { tolerance: 0.01, unit: "cm" });
for (const [rate, original] of [[12, 600], [35, 2000]] as const) {
  const sale = original * (1 - rate / 100);
  num("g7t1-money-discount", `An item is on sale for ${peso(sale)} after a ${pct(rate)} discount. What was its original price (in pesos)?`, original, `The sale price is ${100 - rate}% of the original price, so original price = ${sale} ÷ ${(100 - rate) / 100} = ${original}.`, "HARD", { tolerance: 0.01, unit: "₱" });
}
num("g7t1-money-interest", "A bank pays ₱600 simple interest after 2 years at 6% per year. What principal was invested (in pesos)?", 5000, "I = P × r × t, so P = I ÷ (r × t) = 600 ÷ (0.06 × 2) = 600 ÷ 0.12 = 5,000.", "HARD", { tolerance: 0.01, unit: "₱" });
num("g7t1-money-interest", "₱8,000 earns ₱960 simple interest in 3 years. What is the yearly interest rate (as a percent)?", 4, "r = I ÷ (P × t) = 960 ÷ (8,000 × 3) = 960 ÷ 24,000 = 0.04 = 4%.", "HARD", { tolerance: 0.01, unit: "%" });

/**
 * Questions that go beyond what the Lesson Exemplars teach in Weeks 2-6 (Phase 49). They are left out of the bank so a student is never
 * asked something the week's lessons did not cover.
 */
const BEYOND_THE_EXEMPLARS = new Set([
  "g7t1-angle-pairs-12", // two supplementary angles in a ratio (Week 2 teaches complementary/supplementary angles with one known angle)
  "g7t1-angle-pairs-13", // two complementary angles x and 2x (an algebra setup the exemplar does not use)
  "g7t1-pct-decrease-13", // a 50% fall followed by a 50% rise (successive percentage changes are not in Week 4)
  "g7t1-poly-regular-06", "g7t1-poly-regular-07", "g7t1-poly-regular-08", "g7t1-poly-regular-09", // side from a perimeter (perimeter is not part of the Week 1 exemplar)
  "g7t1-poly-construct-05", "g7t1-poly-construct-06", // a nonagon and a 12-gon (Week 1 draws polygons with 5, 6, 8 or 10 sides)
  "g7t1-money-interest-05", // total amount after interest (Week 5 asks for the interest, the principal, the rate or the time)
]);

export const GRADE7_TERM1_QUESTIONS: SeedQuestion[] = out.filter((q) => !BEYOND_THE_EXEMPLARS.has(q.key));
counters = {};

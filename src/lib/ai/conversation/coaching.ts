/**
 * Phase 40: topic coaching for the built-in tutor.
 *
 * The tutor's planner and realizer were written for integer arithmetic. For the Grade 7 Term 1 topics (polygons and angles, percentages,
 * money, rates) this module supplies what a hint needs to say: the basic idea, small guiding questions, an everyday picture, a worked
 * example with DIFFERENT numbers, and targeted nudges for the usual slips.
 *
 * Rules every piece follows (and tests/sweeps check against every seeded question):
 *  - guiding text never contains the answer, and never repeats the numbers of the student's problem (they could equal the answer);
 *  - nudges for a slip are triggered by the student's actual wrong value (computed from the problem's own numbers) and never state the right one;
 *  - the worked example uses other numbers and its result never equals the student's answer.
 */

export interface CoachPiece { message: string; question: string }
export interface WorkedExample { problem: string; steps: string[] }
export interface Coach {
  kind: string;
  idea: CoachPiece;
  steps: string[];
  context: CoachPiece;
  /** Generic check used when the slip is not recognised. */
  check: CoachPiece;
  /** Specific slips: the wrong value the student typed -> a nudge. */
  slips: Array<{ value: number; message: string; question: string }>;
  /** Builds a worked example with different numbers; undefined when the topic has none. */
  example?: (avoidAnswer: number, skip?: number) => WorkedExample | undefined;
}

export interface CoachInput { prompt: string; skillTitle?: string; expectedAnswer?: string; type?: string }

const NAMES: Record<number, string> = { 3: "triangle", 4: "quadrilateral", 5: "pentagon", 6: "hexagon", 7: "heptagon", 8: "octagon", 9: "nonagon", 10: "decagon" };
const nums = (s: string) => [...s.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
const r1 = (x: number) => Math.round(x * 10) / 10;
const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(r1(x)));
const peso = (x: number) => `₱${Math.round(x).toLocaleString("en-US")}`;
/** The `skip`-th candidate whose result differs from the student's answer (callers retry with a larger skip when the text still clashes). */
const pick = <T,>(list: T[], avoid: number, answerOf: (t: T) => number, skip = 0): T | undefined => list.filter((t) => Math.abs(answerOf(t) - avoid) > 1e-9)[skip];

type Make = (n: number[], p: string) => Coach | undefined;
interface Kind { id: string; re: RegExp; make: Make }

const piece = (message: string, question: string): CoachPiece => ({ message, question });
const slip = (value: number, message: string, question: string) => ({ value: r1(value), message, question });

// ------------------------------------------------------------------------------------------------------------------------------------
// Polygons and angles
// ------------------------------------------------------------------------------------------------------------------------------------
const KINDS: Kind[] = [
  {
    id: "names-count", re: /How many (sides|interior angles) does an? \w+ have/i,
    make: () => ({
      kind: "names-count",
      idea: piece("The name of a polygon tells you how many sides it has: the first part of the name is a Greek prefix for a number (tri- in 'triangle' means three).", "What number does the first part of this polygon's name stand for?"),
      steps: ["Look at the beginning of the polygon's name. Which number does that prefix stand for?", "A polygon has as many vertices as sides. How many interior angles does it have compared with its sides?", "So what number answers the question?"],
      context: piece("Think of words you already know: a bicycle has two wheels and a tricycle has three; the prefix tells the number.", "Which number does the prefix of this polygon's name tell you?"),
      check: piece("Let's read the name carefully.", "What does the first part of the name tell you about the number of sides?"),
      slips: [],
    }),
  },
  {
    id: "ext-total", re: /exterior angles of any convex polygon add up/i,
    make: () => ({
      kind: "ext-total",
      idea: piece("Picture walking around a polygon and turning a little at every corner until you face the way you started.", "How much have you turned in all when you are back to the starting direction?"),
      steps: ["If you walk all the way around a polygon and end up facing the way you started, how much of a turn have you made in total?", "Each turn at a corner is one exterior angle. What do all those turns add up to?", "Does it matter how many sides the polygon has?"],
      context: piece("Think of turning on the spot until you face the same way again.", "What do we call that amount of turning, and how many degrees is it?"),
      check: piece("Let's think about walking around the shape.", "How much do you turn in total before you face the starting direction again?"),
      slips: [],
    }),
  },
  {
    id: "construct-angle", re: /regular (\w+|\d+-sided polygon) from a circle/i,
    make: (n, p) => {
      const sides = /12-sided/.test(p) ? 12 : Number(Object.entries(NAMES).find(([, v]) => p.toLowerCase().includes(v))?.[0]);
      if (!sides) return undefined;
      const mk = (s: number) => ({ problem: `A regular ${s}-sided polygon is drawn from a circle. What is the angle between neighbouring points at the center?`, steps: [`A full turn around the center is 360°.`, `${s} sides need ${s} equal angles.`, `360° ÷ ${s} = ${fmt(360 / s)}°.`], ans: 360 / s });
      return {
        kind: "construct-angle",
        idea: piece("Around the center of the circle there is one full turn, and the points must be spaced equally.", "How many degrees make a full turn?"),
        steps: ["How many degrees make a full turn around the center?", "How many equal angles do you need around the center? Think: one for each side.", "How do you share the full turn equally among those angles?"],
        context: piece("Think of cutting a round cake into equal slices: the slices together make the whole circle.", "If you cut the cake into as many slices as the polygon has sides, how would you find the size of each slice?"),
        check: piece("Let's check which total you are sharing out.", "What is the total angle all around a point, and how many equal parts do you split it into?"),
        slips: [slip(180 / sides, "180° is only a half-turn, and the points go all the way around.", "How many degrees are there in a full turn?")],
        example: (avoid, skip = 0) => { const s = pick([9, 12, 15, 18, 20], avoid, (x) => 360 / x, skip); return s ? { problem: mk(s).problem, steps: mk(s).steps } : undefined; },
      };
    },
  },
  {
    id: "construct-side", re: /marking \d+ points on a circle of radius/i,
    make: () => ({
      kind: "construct-side",
      idea: piece("In a regular hexagon the center and two neighbouring points make a triangle with all sides equal.", "What is the angle at the center, and what does that tell you about the other two angles of the triangle?"),
      steps: ["How many degrees are at the center between two neighbouring points?", "The other two angles of that triangle are equal. How big is each one?", "What kind of triangle has all its angles equal, and what does that say about its sides?"],
      context: piece("Picture a flower with six petals: the distance from the middle to a petal tip is the same as the distance between two tips.", "Which two lengths in the picture are equal, and which length do we want?"),
      check: piece("Let's look at the triangle made by the center and two neighbouring points.", "What do you know about its angles?"),
      slips: [],
    }),
  },
  {
    id: "complementary", re: /complementary\. One measures/i,
    make: (n) => ({
      kind: "complementary",
      idea: piece("Complementary angles together make a right angle.", "How many degrees are in a right angle?"),
      steps: ["How many degrees do two complementary angles make together?", "You know one of them. What operation finds the missing part of a total?", "Can you set it up and check that the two angles add up to the total?"],
      context: piece("Picture the corner of a book opened flat against a wall: the two angles share one corner.", "Together the two angles fill that corner. How big is the corner?"),
      check: piece("Let's check which total complementary angles make.", "Do complementary angles make a right angle or a straight angle?"),
      slips: [slip(180 - n[0], "That is what you would get for supplementary angles.", "Which total belongs to complementary angles, and which to supplementary?")],
      example: (avoid, skip = 0) => { const a = pick([17, 28, 41, 63, 76], avoid, (x) => 90 - x, skip); return a ? { problem: `Two angles are complementary. One measures ${a}°. Find the other.`, steps: [`Complementary angles add up to 90°.`, `Other angle = 90° − ${a}°.`, `= ${90 - a}°.`] } : undefined; },
    }),
  },
  {
    id: "supplementary", re: /supplementary\. One measures|linear pair\. One measures/i,
    make: (n, p) => {
      const lin = /linear pair/i.test(p);
      return {
        kind: "supplementary",
        idea: piece(lin ? "A linear pair is two angles side by side on a straight line, so together they make a straight angle." : "Supplementary angles together make a straight angle.", "How many degrees are in a straight angle?"),
        steps: ["How many degrees do the two angles make together?", "You know one of them. What operation finds the missing part of a total?", "Can you check that your two angles add up to that total?"],
        context: piece("Picture a straight road with a side road joining it: the two angles on one side of the main road fill the straight line.", "How big is the whole straight line?"),
        check: piece("Let's check which total these angles make.", "Do supplementary angles make a right angle or a straight angle?"),
        slips: [slip(90 - n[0], "That is what you would get for complementary angles.", "Which total belongs to supplementary angles, and which to complementary?")].filter((s) => s.value > 0),
        example: (avoid, skip = 0) => { const a = pick([32, 57, 74, 118, 133], avoid, (x) => 180 - x, skip); return a ? { problem: `Two angles are supplementary. One measures ${a}°. Find the other.`, steps: [`Supplementary angles add up to 180°.`, `Other angle = 180° − ${a}°.`, `= ${180 - a}°.`] } : undefined; },
      };
    },
  },
  {
    id: "vertical", re: /vertically opposite/i,
    make: () => ({
      kind: "vertical",
      idea: piece("When two straight lines cross, the angles opposite each other are called vertical angles, and they are equal.", "Which angle is directly opposite the one you know?"),
      steps: ["Draw two crossing lines and mark the angle you know. Which angle is directly across from it?", "Do opposite angles at a crossing have the same size or different sizes?", "What does that tell you about the measure you want?"],
      context: piece("Picture the blades of open scissors: the two opposite openings are always the same size.", "So what can you say about the opening opposite the one you know?"),
      check: piece("Let's look at the picture again.", "Which angle is opposite, and which angles are next to the one you know?"),
      slips: [],
    }),
  },
  {
    id: "ray", re: /ray BD lies inside/i,
    make: () => ({
      kind: "ray",
      idea: piece("A ray inside an angle splits it into two parts, and the two parts add up to the whole angle.", "What is the whole angle, and which part do you already know?"),
      steps: ["What is the measure of the whole angle ABC?", "Which part of it do you already know?", "What operation gives you the other part?"],
      context: piece("Picture a slice of pizza cut by a knife: the two smaller slices make up the original slice.", "How would you find the size of the second slice?"),
      check: piece("Let's compare the parts with the whole.", "What do the two parts add up to?"),
      slips: [],
    }),
  },
  {
    id: "ratio-angles", re: /in the ratio 1 : 3|x and 2x/i,
    make: (n, p) => {
      const supp = /supplementary/i.test(p);
      return {
        kind: "ratio-angles",
        idea: piece(supp ? "The two angles add up to a straight angle, and one is a multiple of the other." : "The two angles add up to a right angle, and one is a multiple of the other.", "Using x for the smaller angle, how would you write the larger one?"),
        steps: ["If the smaller angle is x, how can you write the other angle in terms of x?", "What total do the two angles make?", "Can you write an equation 'x + (the other angle) = total' and solve it?"],
        context: piece("Think of sharing a total between two people where one gets a multiple of the other's share.", "How many equal parts does the total break into?"),
        check: piece("Let's set up an equation.", "What do the two angle expressions add up to?"),
        slips: [],
      };
    },
  },
  {
    id: "ext-int", re: /interior angle is \d+°\. What is the adjacent exterior|exterior angle is \d+°\. What is the adjacent interior/i,
    make: (n, p) => ({
      kind: "ext-int",
      idea: piece("At a vertex, the interior angle and the exterior angle sit side by side on a straight line, so together they make a straight angle.", "How many degrees are in a straight angle?"),
      steps: ["How many degrees do an interior angle and its exterior angle make together?", "You know one of them. What operation finds the other?", "Can you check that the two angles add up to that total?"],
      context: piece("Picture walking along one side of a polygon and then turning at the corner: the turn and the inside angle together make a straight line.", "How would you find the turn if you know the inside angle (or the other way round)?"),
      check: piece("Let's check how the two angles are related.", "Do the interior and exterior angles at one vertex make a right angle or a straight angle?"),
      slips: [slip(90 - n[0], "Those two angles do not make a right angle; they sit on a straight line.", "How many degrees are in a straight line?")].filter((s) => s.value > 0),
      example: (avoid, skip = 0) => { const a = pick([95, 112, 128, 147, 160], avoid, (x) => 180 - x, skip); return a ? { problem: /interior angle is/.test(p) ? `The interior angle at a vertex is ${a}°. Find the adjacent exterior angle.` : `The exterior angle at a vertex is ${a}°. Find the adjacent interior angle.`, steps: [`Interior + exterior = 180°.`, `The missing angle = 180° − ${a}°.`, `= ${180 - a}°.`] } : undefined; },
    }),
  },
  {
    id: "angle-sum", re: /sum of the interior angles of a polygon with \d+ sides/i,
    make: (n) => ({
      kind: "angle-sum",
      idea: piece("A polygon can be cut into triangles by drawing diagonals from one vertex, and every triangle has angles adding up to 180°.", "How many triangles do you get from a polygon with n sides?"),
      steps: ["If you draw all the diagonals from one vertex, how many triangles do you get for a polygon with n sides?", "How many degrees do the angles of one triangle add up to?", "How do you combine those two facts for this polygon?"],
      context: piece("Picture slicing a pentagon-shaped pizza from one corner to the other corners: each cut makes a triangle.", "How many triangles did you get, and what is the angle sum of each?"),
      check: piece("Let's rebuild the idea.", "How many triangles fit inside a polygon with n sides when you cut from one vertex?"),
      slips: [slip(n[0] * 180, "Be careful: the number of triangles is not the same as the number of sides.", "Cutting from one vertex, how many fewer triangles than sides do you get?"), slip((n[0] - 1) * 180, "Check the count of triangles once more.", "Two of the corners do not start a new triangle. How many triangles are there then?")],
      example: (avoid, skip = 0) => { const s = pick([7, 9, 11, 14], avoid, (x) => (x - 2) * 180, skip); return s ? { problem: `What is the sum of the interior angles of a polygon with ${s} sides?`, steps: [`Number of triangles = ${s} − 2 = ${s - 2}.`, `Each triangle has 180°.`, `${s - 2} × 180° = ${(s - 2) * 180}°.`] } : undefined; },
    }),
  },
  {
    id: "each-interior", re: /EACH interior angle of a regular polygon/i,
    make: (n) => ({
      kind: "each-interior",
      idea: piece("In a regular polygon all the interior angles are equal, so each one is the total of the interior angles shared equally.", "What is the total of the interior angles of a polygon with n sides?"),
      steps: ["What is the sum of all the interior angles of a polygon with this many sides?", "In a regular polygon, are the angles equal or different?", "How do you share the total equally among all the angles?"],
      context: piece("Think of a pizza box of equal slices: once you know the whole, each equal slice is the whole shared out.", "What is the whole here, and how many equal parts is it shared among?"),
      check: piece("Let's break it into two parts.", "First find the total of the interior angles. What do you do with it next?"),
      slips: [slip(((n[0] - 2) * 180), "That looks like the total of all the angles rather than one angle.", "How many angles share that total?"), slip(360 / n[0], "That is the size of an exterior angle, but the question asks about an interior angle.", "How are the exterior and interior angles at a vertex related?")],
      example: (avoid, skip = 0) => { const s = pick([9, 12, 15, 18], avoid, (x) => ((x - 2) * 180) / x, skip); return s ? { problem: `What is the measure of each interior angle of a regular polygon with ${s} sides?`, steps: [`Sum of interior angles = (${s} − 2) × 180° = ${(s - 2) * 180}°.`, `${s} equal angles share it.`, `${(s - 2) * 180}° ÷ ${s} = ${fmt(((s - 2) * 180) / s)}°.`] } : undefined; },
    }),
  },
  {
    id: "each-exterior", re: /EACH exterior angle of a regular polygon|exterior angle of a regular polygon is \d+°\. How many sides/i,
    make: (n, p) => {
      const sidesQ = /How many sides/i.test(p);
      return {
        kind: "each-exterior",
        idea: piece("The exterior angles of a convex polygon add up to one full turn, and in a regular polygon they are all equal.", "How many degrees make one full turn?"),
        steps: sidesQ
          ? ["How many degrees do all the exterior angles add up to?", "All the exterior angles are equal here. If you share the full turn into parts of the size you are given, how many parts are there?", "What does the number of parts tell you about the polygon?"]
          : ["How many degrees do all the exterior angles of a polygon add up to?", "In a regular polygon, are the exterior angles equal or different?", "How do you share the total equally among the angles?"],
        context: piece("Picture walking around a regular polygon and turning at each corner: after the last corner you have turned all the way around once.", "If you make equal turns, how do the size of one turn and the number of turns relate to the full turn?"),
        check: piece("Let's use the full turn.", "What is the total of the exterior angles, and how many equal parts does it split into?"),
        slips: sidesQ ? [slip(180 / n[0], "Exterior angles go with the full turn, not a straight angle.", "How many degrees make a full turn?")] : [slip(180 / n[0], "Exterior angles add up to a full turn, not a half-turn.", "How many degrees make a full turn?")],
        example: (avoid, skip = 0) => {
          if (sidesQ) { const e = pick([20, 30, 40, 60], avoid, (x) => 360 / x, skip); return e ? { problem: `Each exterior angle of a regular polygon is ${e}°. How many sides does it have?`, steps: [`All exterior angles add up to 360°.`, `Number of sides = 360° ÷ ${e}°.`, `= ${360 / e}.`] } : undefined; }
          const s = pick([9, 12, 15, 18], avoid, (x) => 360 / x, skip); return s ? { problem: `What is the measure of each exterior angle of a regular polygon with ${s} sides?`, steps: [`All exterior angles add up to 360°.`, `${s} equal angles share it.`, `360° ÷ ${s} = ${fmt(360 / s)}°.`] } : undefined;
        },
      };
    },
  },
  {
    id: "sides-from-sum", re: /interior angles of a polygon add up to \d+°\. How many sides/i,
    make: (n) => ({
      kind: "sides-from-sum",
      idea: piece("The interior angles of a polygon with n sides add up to (n − 2) × 180°, so working backwards from the total gives n.", "How many triangles make up a total of this size?"),
      steps: ["How many triangles' worth of 180° is the given total?", "How is the number of triangles related to the number of sides?", "What do you add to the number of triangles to get the number of sides?"],
      context: piece("Think of the total as a pile of 180° triangle pieces: count the pieces first.", "How many pieces are in the pile, and how many sides does that many pieces give?"),
      check: piece("Let's work backwards from the formula.", "If the total is (n − 2) × 180°, what do you do first to find n − 2?"),
      slips: [slip(n[0] / 180, "That is the number of triangles, but the question asks for the number of sides.", "How many more sides than triangles does a polygon have?"), slip(n[0] / 180 + 1, "Check the connection between triangles and sides once more.", "How many triangles can you cut from a polygon with n sides?")],
      example: (avoid, skip = 0) => { const s = pick([6, 8, 10, 12], avoid, (x) => x, skip); return s ? { problem: `The interior angles of a polygon add up to ${(s - 2) * 180}°. How many sides does it have?`, steps: [`${(s - 2) * 180}° ÷ 180° = ${s - 2} triangles.`, `Sides = triangles + 2.`, `${s - 2} + 2 = ${s}.`] } : undefined; },
    }),
  },
  {
    id: "missing-angle", re: /interior angles of a (quadrilateral|pentagon) are/i,
    make: (n, p) => {
      const quad = /quadrilateral/i.test(p);
      return {
        kind: "missing-angle",
        idea: piece(`The interior angles of a ${quad ? "quadrilateral" : "pentagon"} always add up to the same total.`, "What is that total?"),
        steps: [`What do all the interior angles of a ${quad ? "quadrilateral" : "pentagon"} add up to?`, "What do the angles you are given add up to?", "What operation finds the missing angle from those two totals?"],
        context: piece("Think of a bill that must come to a fixed total: if you know most of the items, the last one is what is left.", "What is the fixed total here, and how much of it is already used?"),
        check: piece("Let's find the missing part of a total.", "What is the total, and what is the sum of the angles you already have?"),
        slips: [],
      };
    },
  },
  // ------------------------------------------------------------------------------------------------------------------------------------
  // Percentages and money
  // ------------------------------------------------------------------------------------------------------------------------------------
  {
    id: "pct-change", re: /(rises|drops) from [\d,]+ to [\d,]+\. What is the percentage|dropped from [\d,]+ to [\d,]+|sold \d+ meals/i,
    make: (n, p) => {
      const up = /increase/i.test(p);
      const [a, b] = n;
      return {
        kind: "pct-change",
        idea: piece(`Percentage ${up ? "increase" : "decrease"} compares the change with the ORIGINAL value: change ÷ original × 100%.`, "Which of the two numbers is the original one?"),
        steps: ["What is the change: how far did the value move? (Use subtraction.)", "Which number is the ORIGINAL value, the one it started from?", "Divide the change by the original value. How do you turn that result into a percent?"],
        context: piece(`Think of a price tag: a ${up ? "rise" : "drop"} of the same amount feels bigger when the original price was small.`, "So what should the change be compared with: the starting price or the new price?"),
        check: piece("Let's check what the change is compared with.", "Did you divide by the original value or by the new value?"),
        slips: [slip((Math.abs(b - a) / b) * 100, "It looks like you divided by the new value. The percentage change is measured against where the value started.", "Which number is the starting value?"), slip(Math.abs(b - a), "That is the size of the change itself, but a percent compares it with the original value.", "What do you divide the change by, and what do you do after that to get a percent?")],
        example: (avoid, skip = 0) => {
          const list: Array<[number, number]> = up ? [[40, 50], [250, 300], [80, 92], [600, 720]] : [[50, 40], [300, 255], [90, 72], [800, 680]];
          const pr = pick(list, avoid, ([x, y]) => (Math.abs(y - x) / x) * 100, skip); return pr ? { problem: `A value ${up ? "rises" : "drops"} from ${pr[0]} to ${pr[1]}. What is the percentage ${up ? "increase" : "decrease"}?`, steps: [`Change = ${Math.max(pr[0], pr[1])} − ${Math.min(pr[0], pr[1])} = ${Math.abs(pr[1] - pr[0])}.`, `Compare with the original, ${pr[0]}: ${Math.abs(pr[1] - pr[0])} ÷ ${pr[0]} = ${fmt(Math.abs(pr[1] - pr[0]) / pr[0])}.`, `As a percent: ${fmt((Math.abs(pr[1] - pr[0]) / pr[0]) * 100)}%.`] } : undefined;
        },
      };
    },
  },
  {
    id: "pct-new", re: /is (increased|decreased) by \d+%\. What is the new/i,
    make: (n, p) => {
      const up = /increased/i.test(p);
      const [a, r] = n;
      return {
        kind: "pct-new",
        idea: piece(`To ${up ? "increase" : "decrease"} a number by a percent, find that percent OF the number, then ${up ? "add it to" : "subtract it from"} the number.`, "How do you find a percent of a number?"),
        steps: ["How do you write the percent as a decimal or fraction?", "Multiply it by the original number. What does that product represent: the change or the new value?", `Then, do you ${up ? "add" : "subtract"} the change to get the new value?`],
        context: piece(`Think of a shop: a ${up ? "price rise" : "sale"} is worked out from the old price, and then the new price is the old price ${up ? "plus" : "minus"} that amount.`, "What would you do with the amount to get the new price?"),
        check: piece("Let's separate the change from the new value.", "Is what you calculated the change, or the new price?"),
        slips: [slip((a * r) / 100, "That number is only the amount of the change. The question asks for the new value.", `What do you do with the change and the original to get the new value?`), slip(a * (1 + (up ? -1 : 1) * (r / 100)), `Check the direction: this is ${up ? "an increase" : "a decrease"}.`, `Should the change be ${up ? "added to" : "taken away from"} the original?`)],
        example: (avoid, skip = 0) => {
          const list: Array<[number, number]> = [[200, 10], [480, 25], [150, 40], [900, 5]];
          const f = (x: [number, number]) => x[0] * (1 + (up ? 1 : -1) * (x[1] / 100));
          const pr = pick(list, avoid, f, skip); return pr ? { problem: `A quantity of ${pr[0]} is ${up ? "increased" : "decreased"} by ${pr[1]}%. What is the new quantity?`, steps: [`${pr[1]}% of ${pr[0]} = ${fmt((pr[0] * pr[1]) / 100)}.`, `${pr[0]} ${up ? "+" : "−"} ${fmt((pr[0] * pr[1]) / 100)}`, `= ${fmt(f(pr))}.`] } : undefined;
        },
      };
    },
  },
  {
    id: "discount", re: /(How much is the discount|What is the sale price|discount rate)/i,
    make: (n, p) => {
      const rateQ = /discount rate/i.test(p), saleQ = /sale price/i.test(p);
      return {
        kind: "discount",
        idea: piece("The discount is a percent of the ORIGINAL price, and the sale price is the original price minus the discount.", "Which price is the discount a percent of?"),
        steps: rateQ ? ["How much was taken off the price? (Use subtraction.)", "Which price is the original one?", "How do you turn 'amount off ÷ original price' into a percent?"] : saleQ ? ["First, how much is the discount? (A percent of which price?)", "Should the discount be added to or taken from the original price?", "What is left after you do that?"] : ["How do you write the percent as a decimal or fraction?", "A percent OF the original price is found by which operation?", "Once you have multiplied, is the result the discount or the sale price?"],
        context: piece("Picture a sign that says '% off' in a shop: the amount off depends on the price before the sale.", "What do you do with the price tag to get the amount off?"),
        check: piece("Let's separate the discount from the sale price.", "Is the number you got the amount taken off, or what you pay?"),
        slips: saleQ ? [slip((n[0] * n[1]) / 100, "That number is the discount itself. The question asks for the sale price.", "What do you do with the discount and the original price to get what you pay?")] : [],
        example: (avoid, skip = 0) => {
          const list: Array<[number, number]> = [[500, 20], [1200, 15], [260, 10], [900, 30]];
          const f = (x: [number, number]) => (rateQ ? x[1] : saleQ ? x[0] * (1 - x[1] / 100) : (x[0] * x[1]) / 100);
          const pr = pick(list, avoid, f, skip); if (!pr) return undefined;
          const off = (pr[0] * pr[1]) / 100;
          return rateQ ? { problem: `A bag originally priced ${peso(pr[0])} is sold for ${peso(pr[0] - off)}. What is the discount rate?`, steps: [`Amount off = ${peso(pr[0])} − ${peso(pr[0] - off)} = ${peso(off)}.`, `${peso(off)} ÷ ${peso(pr[0])} = ${fmt(off / pr[0])}.`, `As a percent: ${pr[1]}%.`] }
            : { problem: `A shirt costs ${peso(pr[0])} and is on sale at ${pr[1]}% off. ${saleQ ? "What is the sale price?" : "How much is the discount?"}`, steps: [`Discount = ${pr[1]}% of ${peso(pr[0])} = ${peso(off)}.`, ...(saleQ ? [`Sale price = ${peso(pr[0])} − ${peso(off)}.`, `= ${peso(pr[0] - off)}.`] : [])] };
        },
      };
    },
  },
  {
    id: "commission-tax", re: /commission|sales tax|VAT/i,
    make: (n, p) => {
      const tax = /tax|VAT/i.test(p), rateQ = /commission rate/i.test(p), totalQ = /pay in all/i.test(p);
      return {
        kind: "commission-tax",
        idea: piece(tax ? "Sales tax is a percent of the price, and it is ADDED to the price when you pay." : "Commission is a percent of the amount sold.", tax ? "What is the tax a percent of?" : "What is the commission a percent of?"),
        steps: rateQ ? ["Which amount is the commission and which is the total sales?", "How do you compare the commission with the sales?", "How do you turn that comparison into a percent?"] : tax ? ["How do you write the tax rate as a decimal or fraction?", "What does the tax rate times the price give you?", totalQ ? "Is the tax added to the price or taken from it, and what do you pay in all?" : "Is that product the tax or the total you pay?"] : ["How do you write the commission rate as a decimal or fraction?", "A percent OF the sales is found by which operation?", "Does your answer look like a small part of the sales?"],
        context: piece(tax ? "Think of a receipt: the price of the item, then the tax line, then the total at the bottom." : "Think of a seller who keeps a small share of every sale they make.", "What would you do with the percent and the amount to get that share?"),
        check: piece("Let's check what the percent is applied to.", "Which amount did you multiply or divide by the percent?"),
        slips: totalQ ? [slip((n[0] * n[1]) / 100, "That number is only the tax. The question asks for what you pay in all.", "What do you do with the tax and the price?")] : [],
        example: (avoid, skip = 0) => {
          const list: Array<[number, number]> = [[400, 12], [1000, 3], [2500, 5], [650, 10]];
          const f = (x: [number, number]) => (rateQ ? x[1] : totalQ ? x[0] * (1 + x[1] / 100) : (x[0] * x[1]) / 100);
          const pr = pick(list, avoid, f, skip); if (!pr) return undefined;
          const amt = (pr[0] * pr[1]) / 100;
          if (rateQ) return { problem: `A salesperson earned ${peso(amt)} commission on sales of ${peso(pr[0])}. What is the commission rate?`, steps: [`${peso(amt)} ÷ ${peso(pr[0])} = ${fmt(amt / pr[0])}.`, `As a percent: ${pr[1]}%.`] };
          return tax ? { problem: `An item costs ${peso(pr[0])} before ${pr[1]}% sales tax. ${totalQ ? "How much do you pay in all?" : "How much is the tax?"}`, steps: [`Tax = ${pr[1]}% of ${peso(pr[0])} = ${peso(amt)}.`, ...(totalQ ? [`Total = ${peso(pr[0])} + ${peso(amt)} = ${peso(pr[0] + amt)}.`] : [])] }
            : { problem: `An agent sells a property for ${peso(pr[0])} and earns a ${pr[1]}% commission. How much is the commission?`, steps: [`Commission = ${pr[1]}% of ${peso(pr[0])}.`, `= ${peso(amt)}.`] };
        },
      };
    },
  },
  {
    id: "interest", re: /simple interest|Simple interest/i,
    make: (n, p) => {
      const totalQ = /how much money will you have/i.test(p), yearsQ = /how many years/i.test(p);
      return {
        kind: "interest",
        idea: piece("Simple interest is I = P × r × t: the principal, times the yearly rate as a decimal, times the number of years.", "Which of the numbers in the problem is the principal, the rate and the time?"),
        steps: yearsQ ? ["What does I = P × r × t say about the interest?", "Which values do you know, and which one is missing?", "How do you undo a multiplication to find the missing value?"] : ["Which number is the principal P, which is the rate r, and which is the time t?", "Write the rate as a decimal. Then multiply the three values. What does the product represent?", totalQ ? "Is the interest the amount you will have in all, or only what you earn on top of the principal?" : "Check the units: is t in years?"],
        context: piece("Think of a savings account: the bank pays you a small percent of your deposit for every year you leave it there.", "How much does it pay for one year, and how many years do you wait?"),
        check: piece("Let's list what we know in the formula.", "What are P, r and t here, and is the rate written as a decimal?"),
        slips: totalQ ? [slip((n[0] * n[1] * n[2]) / 100, "That is only the interest you earn. The question asks for everything you will have.", "What do you do with the interest and the money you started with?")] : [],
        example: (avoid, skip = 0) => {
          const list: Array<[number, number, number]> = [[3000, 5, 2], [8000, 4, 3], [12000, 6, 1], [2500, 8, 4]];
          const f = (x: [number, number, number]) => (yearsQ ? x[2] : totalQ ? x[0] + (x[0] * x[1] * x[2]) / 100 : (x[0] * x[1] * x[2]) / 100);
          const pr = pick(list, avoid, f, skip); if (!pr) return undefined;
          const I = (pr[0] * pr[1] * pr[2]) / 100;
          return yearsQ ? { problem: `${peso(pr[0])} earns ${peso(I)} simple interest at ${pr[1]}% per year. For how many years was it invested?`, steps: [`Interest per year = ${pr[1]}% of ${peso(pr[0])} = ${peso((pr[0] * pr[1]) / 100)}.`, `${peso(I)} ÷ ${peso((pr[0] * pr[1]) / 100)} = ${pr[2]} years.`] }
            : { problem: `${peso(pr[0])} is invested at ${pr[1]}% simple interest per year for ${pr[2]} years. ${totalQ ? "How much money is there at the end?" : "How much interest is earned?"}`, steps: [`I = ${pr[0]} × ${pr[1] / 100} × ${pr[2]} = ${peso(I)}.`, ...(totalQ ? [`Total = ${peso(pr[0])} + ${peso(I)} = ${peso(pr[0] + I)}.`] : [])] };
        },
      };
    },
  },
  {
    id: "budget", re: /allowance|Income ₱|savings|set aside|weekly allowance/i,
    make: (n, p) => {
      const pctQ = /\d+% of/i.test(p);
      return {
        kind: "budget",
        idea: piece(pctQ ? "A percent of an amount is found by multiplying the amount by the percent written as a decimal." : "Savings are what is left of your income after the planned expenses: savings = income − total expenses.", pctQ ? "How do you write the percent as a decimal?" : "What is the total of all the planned expenses?"),
        steps: pctQ ? ["Which amount is the whole, and which is the percent?", "How do you write the percent as a decimal?", "What operation do you use to find a percent of an amount?"] : ["What is the total of all the expenses together?", "What is your income?", "What operation finds what is left?"],
        context: piece("Think of an allowance: first you plan where it goes, and whatever is left over is what you can save.", "How would you find what is left?"),
        check: piece("Let's check the plan.", "Did you add up all the expenses before comparing them with the income?"),
        slips: [],
      };
    },
  },
  // ------------------------------------------------------------------------------------------------------------------------------------
  // Rates
  // ------------------------------------------------------------------------------------------------------------------------------------
  {
    id: "unit-rate", re: /unit rate|rate in liters per minute|What is its speed|What is the speed/i,
    make: (n, p) => {
      const cost = /cost ₱/i.test(p);
      return {
        kind: "unit-rate",
        idea: piece("A unit rate tells how much for ONE of something. To find it, divide the first quantity by the second (the amount per one).", "Which quantity is 'per one' in this question?"),
        steps: ["Which quantity is the 'per one' quantity (the one you divide by)?", "Which quantity goes on top, in the numerator?", "After dividing, do your units read 'something per something' the way the question asks?"],
        context: piece("Think of buying rice: if you know the price of a few kilograms, the price of ONE kilogram is that price shared out.", "How do you share a total price among a number of kilograms?"),
        check: piece("Let's check the direction of the division.", "Did you divide the amount by the number of units, or the other way around?"),
        slips: [slip(cost ? n[0] / n[1] : n[1] / n[0], "It looks like the division went the other way round. A unit rate is the amount per ONE unit.", "Which quantity should be shared among the other?")],
        example: (avoid, skip = 0) => {
          const list: Array<[number, number]> = [[120, 4], [90, 6], [350, 5], [84, 12]];
          const pr = pick(list, avoid, ([x, y]) => x / y, skip); return pr ? { problem: `${pr[0]} kilometers are covered in ${pr[1]} hours. What is the unit rate (kilometers per hour)?`, steps: [`Divide the distance by the time.`, `${pr[0]} ÷ ${pr[1]} = ${fmt(pr[0] / pr[1])}.`] } : undefined;
        },
      };
    },
  },
  {
    id: "speed-distance-time", re: /travels|How long does it take|at a steady speed|km\/h/i,
    make: (n, p) => {
      const timeQ = /how long/i.test(p), distQ = /how far/i.test(p);
      return {
        kind: "speed-distance-time",
        idea: piece("Speed, distance and time are linked: speed = distance ÷ time, distance = speed × time, time = distance ÷ speed.", "Which of the three do you know, and which do you want?"),
        steps: ["Which two of speed, distance and time are given, and which one is asked?", "Which of the three relationships has your unknown on its own side?", "Can you use it with the numbers and check that the units match (km, hours, km/h)?"],
        context: piece("Think of a trip on a jeepney: if you go farther at the same speed it takes more time, and a faster speed takes less time.", "Which of the three quantities is 'how fast' and which is 'how long'?"),
        check: piece("Let's pick the right relationship.", "Which quantity are you looking for: speed, distance or time?"),
        slips: distQ ? [slip(n[0] / n[1], "It looks like the speed was divided by the time. Distance comes from the speed and the time put together.", "What operation combines speed and time into distance?")] : timeQ ? [slip(n[1] === 0 ? 0 : n[1] / n[0], "It looks like the division went the other way round.", "Distance is shared by speed; which quantity goes on top?")] : [],
        example: (avoid, skip = 0) => {
          const list: Array<[number, number]> = [[120, 3], [180, 4], [210, 6], [90, 2]];
          const f = ([d, t]: [number, number]) => (timeQ ? t : distQ ? (d / t) * t : d / t);
          const pr = pick(list, avoid, f, skip); if (!pr) return undefined;
          const s = pr[0] / pr[1];
          return timeQ ? { problem: `How long does it take to travel ${pr[0]} km at ${s} km/h?`, steps: [`Time = distance ÷ speed.`, `${pr[0]} ÷ ${s} = ${pr[1]} hours.`] }
            : distQ ? { problem: `A van travels at ${s} km/h for ${pr[1]} hours. How far does it go?`, steps: [`Distance = speed × time.`, `${s} × ${pr[1]} = ${pr[0]} km.`] }
              : { problem: `A jeepney travels ${pr[0]} km in ${pr[1]} hours at a steady speed. What is its speed?`, steps: [`Speed = distance ÷ time.`, `${pr[0]} ÷ ${pr[1]} = ${fmt(s)} km/h.`] };
        },
      };
    },
  },
  {
    id: "rate-scale", re: /At this rate/i,
    make: () => ({
      kind: "rate-scale",
      idea: piece("When something happens at a steady rate, first find the amount for ONE unit, then multiply by the number of units you want.", "How much happens in one unit (one hour, one day)?"),
      steps: ["How much is done in ONE unit of time? (Divide.)", "How many units of time do you want?", "What do you do with the unit rate and the number of units?"],
      context: piece("Think of earning a daily wage: once you know the pay for one day, any number of days is easy.", "What would you do with the pay for one day to get the pay for several days?"),
      check: piece("Let's find the rate for one first.", "Did you work out the amount for ONE unit before scaling up?"),
      slips: [],
    }),
  },
];

// ------------------------------------------------------------------------------------------------------------------------------------
// Concept coaching by skill (for multiple-choice and true/false questions, and as a fallback for numeric ones)
// ------------------------------------------------------------------------------------------------------------------------------------
const CONCEPTS: Array<{ re: RegExp; make: () => Coach }> = [
  { re: /define and identify polygons/i, make: () => concept("polygon-define", "A polygon is a closed figure made only of straight line segments that meet at their endpoints.", ["Is the figure closed?", "Is every side a straight segment, or is one curved?", "Do the segments meet only at their endpoints, without crossing?"], "Think of a fence around a field: it has to close up, and each section is straight.") },
  { re: /name polygons by number of sides/i, make: () => concept("polygon-names", "Polygons are named by their number of sides: tri- 3, quadri- 4, penta- 5, hexa- 6, hepta- 7, octa- 8, nona- 9, deca- 10.", ["How many sides does the figure have? Count them one by one.", "Which prefix means that number?", "Does the name you chose match the prefix?"], "Think of an octopus with eight arms: 'octa' means eight.") },
  { re: /classify regular and irregular polygons/i, make: () => concept("polygon-regular", "A polygon is regular only if ALL its sides are equal AND ALL its angles are equal; otherwise it is irregular.", ["Are all the sides equal?", "Are all the angles equal?", "Do you need both to be true for a regular polygon?"], "Think of a square tile and a rectangular tile: one fits the 'all equal' test, the other does not.") },
  { re: /draw regular polygons/i, make: () => concept("polygon-construct", "To draw a regular polygon, mark equally spaced points around a circle and join neighbouring points; the points are 360° ÷ (number of sides) apart.", ["How many degrees are in a full turn around the center?", "How many points do you need?", "How do you share the full turn among the points?"], "Think of cutting a round cake into equal slices.") },
  { re: /classify convex and non-convex polygons/i, make: () => concept("polygon-convex", "A convex polygon has every interior angle less than 180°; a non-convex polygon has at least one interior angle greater than 180°.", ["Look at each interior angle: is any of them more than a straight angle?", "Does any vertex point inward?", "What does one angle greater than 180° tell you about the polygon?"], "Think of an arrowhead or a boomerang: one corner dents inward.") },
  { re: /angle-pair relationships/i, make: () => concept("angle-pairs", "Complementary angles add up to 90°, supplementary angles to 180°, a linear pair is supplementary, and vertical angles are equal.", ["Which total (90° or 180°) belongs to the pair named in the question?", "Is the pair side by side on a line, or opposite each other at a crossing?", "What does the relationship tell you about the angles?"], "Think of a corner of a page (90°) and a straight edge (180°).") },
  { re: /exterior and interior angles/i, make: () => concept("ext-int", "An interior angle and the exterior angle next to it sit on a straight line, so they add up to 180°.", ["Which two angles are on the straight line?", "What do they add up to?", "How do you find the missing one?"], "Think of walking along a side and turning at the corner.") },
  { re: /angle measures and number of sides/i, make: () => concept("polygon-angles", "Interior angles of an n-sided polygon add up to (n − 2) × 180°, and the exterior angles of a convex polygon add up to 360°.", ["Is the question about interior or exterior angles?", "Which total applies, and how many angles share it?", "What do you do to find one angle or the number of sides?"], "Think of cutting the polygon into triangles from one vertex.") },
  { re: /percentage increase/i, make: () => concept("pct-increase", "Percentage change = change ÷ ORIGINAL value × 100%.", ["What is the change?", "Which number is the original?", "How do you turn the result into a percent?"], "Think of a price that goes up: compare the rise with the old price.") },
  { re: /percentage decrease/i, make: () => concept("pct-decrease", "Percentage decrease = decrease ÷ ORIGINAL value × 100%, and a new value after a decrease is the original minus the decrease.", ["What is the size of the drop?", "Which number is the original?", "Is the new value bigger or smaller than the original?"], "Think of a sale: the amount off is compared with the price before the sale.") },
  { re: /discount and sale price/i, make: () => concept("discount", "Discount = original price × rate, and sale price = original price − discount.", ["Which price is the discount a percent of?", "Is the discount added to or taken from the original?", "Which quantity does the question ask for?"], "Think of a '20% off' sign.") },
  { re: /commission and sales tax/i, make: () => concept("commission-tax", "Commission = sales × rate. Sales tax = price × rate, and it is added to the price.", ["What is the percent applied to?", "Is the amount an addition to what you pay, or a share kept by a seller?", "What do you do with the percent and the amount?"], "Think of a receipt and of a seller's share.") },
  { re: /simple interest/i, make: () => concept("interest", "Simple interest I = P × r × t, with the rate as a decimal and the time in years.", ["What are P, r and t here?", "Is the rate written as a decimal?", "Does the question ask for the interest or the total amount?"], "Think of a savings account that pays you each year.") },
  { re: /financial plan/i, make: () => concept("budget", "Savings = income − planned expenses, and a percent of an amount is the amount × the percent as a decimal.", ["What is the income?", "What are the planned expenses together?", "What is left?"], "Think of an allowance planned before it is spent.") },
  { re: /identify rates and unit rates/i, make: () => concept("rate-identify", "A rate compares two quantities with different units; a unit rate has 1 as its second quantity (per one).", ["Are the two quantities measured in the same units or in different units?", "Does one of them equal 1 (for example per hour)?", "What does 'per' tell you?"], "Think of price per kilogram or kilometers per hour.") },
  { re: /express rates as unit rates/i, make: () => concept("rate-unit", "To write a rate as a unit rate, divide the first quantity by the second.", ["Which quantity is 'per one'?", "Which quantity do you divide by?", "Do the units read 'amount per one'?"], "Think of finding the price of one piece from the price of several.") },
  { re: /problems involving rates/i, make: () => concept("rate-problems", "Find the unit rate first, then scale it; speed = distance ÷ time.", ["What is the rate for ONE unit?", "How many units do you need?", "What do you do with the unit rate and that number?"], "Think of a daily wage or a steady speed.") },
];

function concept(kind: string, idea: string, steps: string[], picture: string): Coach {
  return {
    kind,
    idea: piece(`Here is the key idea: ${idea}`, steps[0]),
    steps,
    context: piece(picture, "How does that picture help you decide on your answer?"),
    check: piece("Let's go back to the key idea.", "Which part of the idea decides this question?"),
    slips: [],
  };
}

/** Coaching for a question, or undefined when this module does not know the topic (the caller then keeps its neutral wording). */
export function coachFor(input: CoachInput): Coach | undefined {
  const prompt = input.prompt ?? "";
  if (input.type === "NUMERIC_INPUT" || (!input.type && /\d/.test(prompt))) {
    const n = nums(prompt);
    for (const k of KINDS) {
      if (!k.re.test(prompt)) continue;
      const c = k.make(n, prompt);
      if (c) return c;
    }
  }
  const title = input.skillTitle ?? "";
  const hit = CONCEPTS.find((c) => c.re.test(title));
  return hit ? hit.make() : undefined;
}

/**
 * A worked example whose text contains none of the given numbers as a standalone number: the student's correct answer (so the answer guard never
 * rejects it) and the value the student just typed (an example that ends in the student's own wrong answer would look like a confirmation).
 */
export function exampleFor(coach: Coach, avoid: number[]): WorkedExample | undefined {
  if (!coach.example) return undefined;
  const real = avoid.filter((x) => Number.isFinite(x));
  const tokens = real.map((x) => new RegExp(`(?<![\\d.])${String(x).replace(".", "\\.")}(?![\\d])`));
  for (let skip = 0; skip < 8; skip++) {
    const ex = coach.example(real[0] ?? Number.NaN, skip);
    if (!ex) return undefined;
    const text = `${ex.problem} ${ex.steps.join(" ")}`.replace(/,/g, "");
    if (!tokens.some((tk) => tk.test(text))) return ex;
  }
  return undefined;
}

/** A nudge for a recognised slip: matches the student's number against the values the usual mistakes would give. */
export function slipFor(coach: Coach, attempted: number | undefined): { message: string; question: string } | undefined {
  if (attempted === undefined || !Number.isFinite(attempted)) return undefined;
  const s = coach.slips.find((x) => Math.abs(x.value - attempted) < 0.06);
  return s ? { message: s.message, question: s.question } : undefined;
}

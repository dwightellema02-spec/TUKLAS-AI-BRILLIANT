/**
 * Grade 7 Mathematics, Term 1, weeks 1-6: units, competencies, skills (with prerequisites), lessons and the question bank.
 * Scope follows the DepEd MATATAG Grade 7 Budget of Work; all text is original (see grade7-term1-types.ts).
 */
import type { SeedUnit, SeedCompetency, SeedSkill } from "./grade7-term1-types";
export { GRADE7_TERM1_QUESTIONS } from "./grade7-term1-questions";
export { GRADE7_TERM1_LESSONS } from "./grade7-term1-lessons";

export const GRADE7_TERM1_UNITS: SeedUnit[] = [
  { key: "A", sequenceOrder: 1, title: "Measurement and Geometry: Polygons", description: "Polygons, their classification, angle pairs, and interior and exterior angles (Term 1, Weeks 1-3)." },
  { key: "B", sequenceOrder: 2, title: "Number and Algebra: Percentages and Rates", description: "Percentage increase and decrease, money problems, a simple financial plan, and rates (Term 1, Weeks 4-6)." },
];

export const GRADE7_TERM1_COMPETENCIES: SeedCompetency[] = [
  { key: "w1", code: "G7-T1-W1", unit: "A", week: 1, statement: "Draws and describes regular and irregular polygons with 5, 6, 8 or 10 sides using a ruler, compass and protractor." },
  { key: "w2", code: "G7-T1-W2", unit: "A", week: 2, statement: "Illustrates angle pairs and classifies polygons as regular or irregular and as convex or non-convex." },
  { key: "w3", code: "G7-T1-W3", unit: "A", week: 3, statement: "Relates an exterior angle to the adjacent interior angle, and finds the angle measures and the number of sides of polygons." },
  { key: "w4", code: "G7-T1-W4", unit: "B", week: 4, statement: "Solves problems involving percentage increase and percentage decrease." },
  { key: "w5", code: "G7-T1-W5", unit: "B", week: 5, statement: "Solves money problems involving percentages (discount, commission, sales tax, simple interest) and creates a simple financial plan." },
  { key: "w6", code: "G7-T1-W6", unit: "B", week: 6, statement: "Identifies and explains the uses of rates, expresses rates as unit rates, and solves problems involving rates such as speed." },
];

const s = (key: string, title: string, description: string, difficulty: number, competency: string, prerequisites: string[] = []): SeedSkill => ({ key, title, description, difficulty, competency, prerequisites });

export const GRADE7_TERM1_SKILLS: SeedSkill[] = [
  s("g7t1-poly-define", "Define and identify polygons", "Tell polygons from non-polygons and name their parts (sides, vertices, interior angles).", 1.0, "w1"),
  s("g7t1-poly-names", "Name polygons by number of sides", "Name polygons with 3 to 10 sides.", 1.2, "w1", ["g7t1-poly-define"]),
  s("g7t1-poly-regular", "Classify regular and irregular polygons", "Decide whether a polygon is regular (equal sides and equal angles) or irregular.", 1.8, "w1", ["g7t1-poly-names"]),
  s("g7t1-poly-construct", "Draw regular polygons", "Plan the central angle and side measures for drawing regular polygons with a compass, protractor and ruler.", 2.2, "w1", ["g7t1-poly-regular"]),
  s("g7t1-poly-convex", "Classify convex and non-convex polygons", "Use interior angle sizes to classify polygons as convex or non-convex.", 2.0, "w2", ["g7t1-poly-regular"]),
  s("g7t1-angle-pairs", "Use angle-pair relationships", "Use complementary, supplementary, linear-pair and vertical angles to find unknown angles.", 2.2, "w2"),
  s("g7t1-ext-int", "Relate exterior and interior angles", "Use the fact that an interior angle and its adjacent exterior angle add up to 180 degrees.", 2.0, "w3", ["g7t1-angle-pairs"]),
  s("g7t1-polygon-angles", "Find angle measures and number of sides of polygons", "Use the interior angle sum (n - 2) x 180 and exterior angle sum 360 to find angles and the number of sides.", 3.0, "w3", ["g7t1-ext-int", "g7t1-poly-names"]),
  s("g7t1-pct-increase", "Solve percentage increase problems", "Find the percentage increase and the new value after an increase.", 2.0, "w4"),
  s("g7t1-pct-decrease", "Solve percentage decrease problems", "Find the percentage decrease and the new value after a decrease.", 2.2, "w4", ["g7t1-pct-increase"]),
  s("g7t1-money-discount", "Solve discount and sale price problems", "Compute discounts and sale prices.", 2.5, "w5", ["g7t1-pct-decrease"]),
  s("g7t1-money-commission", "Solve commission and sales tax problems", "Compute commission and sales tax (VAT) and total amounts.", 2.7, "w5", ["g7t1-money-discount"]),
  s("g7t1-money-interest", "Solve simple interest problems", "Use I = P x r x t to find interest and total amounts.", 3.0, "w5", ["g7t1-money-commission"]),
  s("g7t1-money-budget", "Create a simple financial plan", "Compute savings and percentages of income in a daily budget.", 2.5, "w5", ["g7t1-money-discount"]),
  s("g7t1-rate-identify", "Identify rates and unit rates", "Tell rates from ratios and recognise unit rates and where rates are used.", 1.5, "w6"),
  s("g7t1-rate-unit", "Express rates as unit rates", "Divide to write a rate as a unit rate and compare offers.", 2.2, "w6", ["g7t1-rate-identify"]),
  s("g7t1-rate-problems", "Solve problems involving rates", "Solve speed, distance, time and price-per-unit problems.", 2.8, "w6", ["g7t1-rate-unit"]),
];

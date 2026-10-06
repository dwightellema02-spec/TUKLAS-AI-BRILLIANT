/**
 * Lessons for Grade 7 Term 1, weeks 1-6 (original text written for this platform; scope follows the DepEd MATATAG Grade 7
 * Mathematics Budget of Work). Math in $...$ is rendered with KaTeX by the lesson player.
 */
import type { SeedLesson, SeedBlock } from "./grade7-term1-types";
import { regularPolygonsDiagram, convexConcaveDiagram, intersectingLinesDiagram, interiorExteriorDiagram, constructionDiagram } from "./grade7-term1-diagrams";

const text = (title: string, content: string): SeedBlock => ({ type: "TEXT", title, content });
const hint = (title: string, content: string): SeedBlock => ({ type: "HINT", title, content });
const summary = (title: string, content: string): SeedBlock => ({ type: "SUMMARY", title, content });
const image = (title: string, url: string, alt: string, caption: string): SeedBlock => ({ type: "IMAGE", title, content: caption, metadata: { url, alt, caption } });
const example = (title: string, problem: string, steps: string[], answer: string): SeedBlock => ({
  type: "EXAMPLE", title,
  content: `Problem: ${problem}\n\n${steps.map((s, i) => `Step ${i + 1}: ${s}`).join("\n")}\n\nAnswer: ${answer}`,
  metadata: { problem, steps, answer },
});
const check = (title: string, question: string, options: string[], correctAnswer: string, explanation: string): SeedBlock => ({
  type: "CHECKPOINT", title, content: question, metadata: { question, options, correctAnswer, explanation },
});
const practice = (skillName: string, count: number): SeedBlock => ({
  type: "PRACTICE", title: "Practice what you learned", content: "Try the practice set for this lesson. Answer on your own first; the AI tutor is there to guide you if you get stuck.",
  metadata: { skillName, questionCount: count, difficulty: "Mixed" },
});

export const GRADE7_TERM1_LESSONS: SeedLesson[] = [
  // ------------------------------------------------------------------ Week 1
  {
    key: "g7t1-w1", week: 1, unit: "A", title: "Polygons: Naming, Regular and Irregular, and Drawing Them",
    description: "What a polygon is, how polygons are named by their sides, how regular and irregular polygons differ, and how to draw regular polygons with a compass, protractor and ruler.",
    objectives: ["Define a polygon and tell polygons from non-polygons", "Name polygons with 3 to 10 sides", "Classify polygons as regular or irregular", "Draw regular polygons with 5, 6, 8 or 10 sides using a compass, protractor and ruler"],
    minutes: 45, skills: ["g7t1-poly-define", "g7t1-poly-names", "g7t1-poly-regular", "g7t1-poly-construct"],
    teacherNote: "Aligned with the Budget of Work, Grade 7 Term 1 Week 1 (draw and describe regular and irregular polygons with 5, 6, 8 or 10 sides). The DepEd Lesson Exemplar Q1 Lesson 1 has the classroom procedure and group activities; this online lesson adds practice and tutoring and does not replace the drawing work with real instruments.",
    blocks: [
      text("1. Shapes all around us", "Look around: road signs, window frames, floor tiles, honeycombs. Many of the shapes you see are **polygons**.\n\nA **polygon** is a closed figure on a flat surface that is made only of **straight line segments**. The segments (called **sides**) meet only at their endpoints (called **vertices**, or corners). The angles inside the figure are its **interior angles**."),
      text("2. What is NOT a polygon?", "A figure is **not** a polygon if\n\n• it has a **curved** side (like a circle or a half-moon),\n• it is **open** (the last segment does not meet the first), or\n• its sides **cross** each other instead of meeting only at endpoints.\n\nA polygon always has the **same number of sides, vertices and interior angles**, and the smallest polygon has 3 sides."),
      check("Checkpoint: Is it a polygon?", "Which figure is a polygon?", ["A circle", "A closed figure made of 5 straight segments", "Two lines that cross", "A shape with one curved side"], "A closed figure made of 5 straight segments", "A polygon is closed and made only of straight segments. The pentagon (5 segments) qualifies."),
      image("3. Polygons and their names", regularPolygonsDiagram(), "Regular polygons with 3, 4, 5, 6, 8 and 10 sides", "A polygon is named by its number of sides: triangle (3), quadrilateral (4), pentagon (5), hexagon (6), heptagon (7), octagon (8), nonagon (9), decagon (10)."),
      text("4. Naming polygons and their parts", "The prefixes come from Greek: **tri**- (3), **quadri**- (4), **penta**- (5), **hexa**- (6), **hepta**- (7), **octa**- (8), **nona**- (9), **deca**- (10).\n\nA polygon is also named by its vertices in order. A triangle with vertices $A$, $B$, $C$ is **triangle $ABC$**. Its sides are $AB$, $BC$ and $AC$. Its interior angles are $\\angle A$, $\\angle B$ and $\\angle C$."),
      check("Checkpoint: Names", "What do you call a polygon with 8 sides?", ["Hexagon", "Heptagon", "Octagon", "Decagon"], "Octagon", "Octa- means eight, so a polygon with 8 sides is an octagon."),
      text("5. Regular or irregular?", "A polygon is **equilateral** if all its sides are equal and **equiangular** if all its angles are equal.\n\nA **regular polygon** is both equilateral and equiangular. A polygon that is not regular is **irregular**.\n\n• A square is regular (4 equal sides, 4 right angles).\n• A rectangle that is not a square is **irregular**: its angles are equal but its sides are not.\n• A rhombus that is not a square is **irregular**: its sides are equal but its angles are not.\n\nBoth conditions are needed. Equal sides alone are not enough."),
      example("6. Worked example: the side of a regular polygon", "A regular hexagon has a perimeter of 42 cm. How long is each side?", ["A regular hexagon has 6 equal sides.", "The perimeter is the sum of the sides, so divide it by the number of sides.", "Each side = $42 \\div 6$."], "Each side is 7 cm."),
      hint("Common mistake", "\"All sides equal\" does **not** make a polygon regular. A rhombus has 4 equal sides but angles of different sizes, so it is irregular. Always check the angles too."),
      image("7. Drawing a regular polygon", constructionDiagram(), "A circle with five equal angles at the center and the regular pentagon joining the points", "To draw a regular polygon with $n$ sides, mark $n$ points on a circle at equal angles of $360^\\circ \\div n$ around the center, then join neighbouring points."),
      text("8. Try it on paper (with real instruments)", "Draw a regular **pentagon**:\n\n1. With a compass, draw a circle with radius 2 cm. Mark its center.\n2. Use a protractor at the center to mark points every $72^\\circ$ around the circle ($360 \\div 5 = 72$).\n3. Use a ruler to join the 5 points in order.\n\nNow repeat for a hexagon (every $60^\\circ$), an octagon (every $45^\\circ$) and a decagon (every $36^\\circ$). Check by measuring: the sides should all be equal. This part is done with real tools; the practice set below checks the ideas behind it."),
      check("Checkpoint: Drawing", "To draw a regular octagon from a circle, at what angle do you mark the points around the center?", ["30°", "45°", "60°", "72°"], "45°", "$360 \\div 8 = 45$, so the points are 45° apart."),
      practice("Polygons: define, name, regular, construct", 12),
      summary("Key ideas", "• A **polygon** is a closed figure made of straight line segments that meet only at their endpoints; it has at least 3 sides, and as many vertices and interior angles as sides.\n• Polygons are named by their number of sides (triangle, quadrilateral, pentagon, hexagon, heptagon, octagon, nonagon, decagon).\n• A **regular** polygon has all sides equal **and** all angles equal; otherwise it is **irregular**.\n• To draw a regular $n$-gon, mark points $360^\\circ \\div n$ apart on a circle and join them."),
    ],
    practice: ["g7t1-poly-define-01", "g7t1-poly-define-02", "g7t1-poly-define-05", "g7t1-poly-names-01", "g7t1-poly-names-02", "g7t1-poly-names-08", "g7t1-poly-regular-01", "g7t1-poly-regular-03", "g7t1-poly-regular-06", "g7t1-poly-construct-01", "g7t1-poly-construct-02", "g7t1-poly-construct-07"],
  },
  // ------------------------------------------------------------------ Week 2
  {
    key: "g7t1-w2", week: 2, unit: "A", title: "Convex and Non-Convex Polygons; Angle Pairs",
    description: "How to tell convex from non-convex polygons by their interior angles, and the relationships between pairs of angles: complementary, supplementary, adjacent, linear pairs and vertical angles.",
    objectives: ["Classify polygons as convex or non-convex", "Identify complementary, supplementary, adjacent, linear-pair and vertical angles", "Use angle-pair relationships to find unknown angle measures"],
    minutes: 45, skills: ["g7t1-poly-convex", "g7t1-angle-pairs"],
    teacherNote: "Aligned with the Budget of Work, Grade 7 Term 1 Week 2 (classify polygons as regular/irregular and convex/non-convex; angle pairs). See DepEd Lesson Exemplar Q1 Lesson 2 for the measuring activities with a protractor.",
    blocks: [
      text("1. Two kinds of outlines", "In Week 1 we classified polygons by their sides and as regular or irregular. Polygons can also be classified by their **angles**.\n\nA **convex polygon** has **all interior angles less than $180^\\circ$**. No vertex points inward, and a straight segment joining any two points inside the polygon stays inside it.\n\nA **non-convex (concave) polygon** has **at least one interior angle greater than $180^\\circ$**. One vertex points inward, like the tip of an arrowhead cut out of the shape."),
      image("2. Convex and non-convex", convexConcaveDiagram(), "A convex pentagon and a non-convex arrowhead quadrilateral with its inward angle marked", "Left: convex, every interior angle is less than 180°. Right: non-convex, one interior angle is more than 180°."),
      example("3. Worked example: convex or not?", "A quadrilateral has interior angles $40^\\circ$, $50^\\circ$, $230^\\circ$ and $40^\\circ$. Is it convex?", ["Check whether every angle is less than $180^\\circ$.", "$230^\\circ$ is greater than $180^\\circ$."], "No: it is non-convex, because one interior angle is greater than $180^\\circ$. (The angles still add up to $360^\\circ$, as they must for any quadrilateral.)"),
      check("Checkpoint: Convex", "A polygon has one interior angle of 200°. It is", ["convex", "non-convex", "regular", "impossible"], "non-convex", "An interior angle greater than 180° makes a polygon non-convex."),
      text("4. Angle pairs", "Angles often come in pairs with special relationships:\n\n• **Complementary angles** add up to $90^\\circ$.\n• **Supplementary angles** add up to $180^\\circ$.\n• **Adjacent angles** share a vertex and one side and do not overlap.\n• A **linear pair** is two adjacent angles on a straight line; they are supplementary ($180^\\circ$).\n• **Vertical angles** are the opposite angles formed when two lines cross; they are **equal**."),
      image("5. Two lines that cross", intersectingLinesDiagram(), "Two crossing lines with four angles numbered 1 to 4", "Angles 1 and 3 are vertical (equal), 2 and 4 are vertical (equal), and 1 and 2 form a linear pair (add up to 180°)."),
      example("6. Worked example: complementary angles", "Two angles are complementary. One measures $58^\\circ$. Find the other.", ["Complementary angles add up to $90^\\circ$.", "Other angle $= 90 - 58$."], "The other angle is $32^\\circ$."),
      example("7. Worked example: an equation from a linear pair", "Two angles in a linear pair measure $x$ and $2x + 30$ (in degrees). Find $x$.", ["A linear pair adds up to $180^\\circ$: $x + (2x + 30) = 180$.", "Combine like terms: $3x + 30 = 180$, so $3x = 150$.", "$x = 150 \\div 3 = 50$."], "$x = 50$, so the angles are $50^\\circ$ and $130^\\circ$."),
      check("Checkpoint: Angle pairs", "Two angles measure 100° and 80°. They are", ["complementary", "supplementary", "vertical", "adjacent"], "supplementary", "$100 + 80 = 180$, so they are supplementary. (Whether they are also adjacent depends on where they are.)"),
      hint("Common mistake", "Do not mix up the two words: **c**omplementary comes before **s**upplementary in the alphabet, and $90$ comes before $180$. Also, supplementary angles do **not** have to be next to each other; only a *linear pair* has to be adjacent."),
      practice("Convex polygons and angle pairs", 12),
      summary("Key ideas", "• **Convex**: all interior angles $< 180^\\circ$. **Non-convex**: at least one interior angle $> 180^\\circ$.\n• Complementary angles add up to $90^\\circ$; supplementary angles add up to $180^\\circ$.\n• A linear pair is adjacent and supplementary.\n• Vertical angles (opposite angles at a crossing) are equal."),
    ],
    practice: ["g7t1-poly-convex-01", "g7t1-poly-convex-04", "g7t1-poly-convex-05", "g7t1-angle-pairs-01", "g7t1-angle-pairs-05", "g7t1-angle-pairs-09", "g7t1-angle-pairs-10", "g7t1-angle-pairs-11", "g7t1-angle-pairs-13", "g7t1-angle-pairs-14", "g7t1-angle-pairs-15", "g7t1-angle-pairs-16"],
  },
  // ------------------------------------------------------------------ Week 3
  {
    key: "g7t1-w3", week: 3, unit: "A", title: "Interior and Exterior Angles of Polygons",
    description: "The relationship between an exterior angle and its adjacent interior angle, the sum of the interior angles of any polygon, and finding angle measures and the number of sides.",
    objectives: ["State and use the relationship between an exterior angle and the adjacent interior angle", "Find the sum of the interior angles of a polygon with n sides", "Find each angle of a regular polygon and the number of sides from given angle measures"],
    minutes: 50, skills: ["g7t1-ext-int", "g7t1-polygon-angles"],
    teacherNote: "Aligned with the Budget of Work, Grade 7 Term 1 Week 3 (relationship between the exterior angle and the adjacent interior angle; measures of angles and number of sides of polygons). See DepEd Lesson Exemplar Q1 Lesson 3 for the classroom activities.",
    blocks: [
      text("1. Inside and outside", "At each vertex of a polygon there is an **interior angle** (inside the polygon). If you extend one side past that vertex, the angle between the extension and the next side is an **exterior angle**.\n\nThe interior angle and the exterior angle at the same vertex sit on a straight line, so they form a **linear pair**:\n\n$$\\text{interior angle} + \\text{exterior angle} = 180^\\circ$$"),
      image("2. Interior and exterior at one vertex", interiorExteriorDiagram(), "A triangle with one side extended to show the exterior angle", "Interior angle + adjacent exterior angle = 180° because together they make a straight line."),
      example("3. Worked example", "An interior angle of a polygon is $135^\\circ$. Find the adjacent exterior angle.", ["Interior + exterior $= 180^\\circ$.", "Exterior $= 180 - 135$."], "The exterior angle is $45^\\circ$."),
      check("Checkpoint: Exterior angle", "The exterior angle at a vertex is 72°. What is the interior angle there?", ["72°", "98°", "108°", "118°"], "108°", "$180 - 72 = 108$."),
      text("4. The sum of the interior angles", "Any polygon with $n$ sides can be cut into $n - 2$ triangles by drawing diagonals from one vertex. Each triangle has angles adding up to $180^\\circ$, so\n\n$$\\text{sum of interior angles} = (n - 2) \\times 180^\\circ$$\n\n• Triangle ($n=3$): $180^\\circ$\n• Quadrilateral ($n=4$): $360^\\circ$\n• Pentagon ($n=5$): $540^\\circ$\n• Hexagon ($n=6$): $720^\\circ$\n• Octagon ($n=8$): $1080^\\circ$"),
      example("5. Worked example: a missing angle", "Four interior angles of a pentagon are $100^\\circ$, $110^\\circ$, $120^\\circ$ and $90^\\circ$. Find the fifth.", ["The interior angles of a pentagon add up to $(5-2) \\times 180 = 540^\\circ$.", "The four known angles add up to $100 + 110 + 120 + 90 = 420^\\circ$.", "Fifth angle $= 540 - 420$."], "The fifth angle is $120^\\circ$."),
      text("6. Regular polygons", "In a **regular** polygon all interior angles are equal, so\n\n$$\\text{each interior angle} = \\frac{(n-2) \\times 180^\\circ}{n}$$\n\nFor example, each interior angle of a regular hexagon is $720 \\div 6 = 120^\\circ$ and of a regular octagon is $1080 \\div 8 = 135^\\circ$.\n\nThe **exterior angles of any convex polygon add up to $360^\\circ$** (one full turn when you walk around it). For a regular polygon each exterior angle is\n\n$$\\frac{360^\\circ}{n}$$"),
      example("7. Worked example: find the number of sides", "Each exterior angle of a regular polygon is $36^\\circ$. How many sides does it have?", ["Each exterior angle is $360 \\div n$, so $360 \\div n = 36$.", "$n = 360 \\div 36$."], "The polygon has 10 sides (a regular decagon)."),
      check("Checkpoint: Sum of angles", "What is the sum of the interior angles of a hexagon?", ["360°", "540°", "720°", "900°"], "720°", "$(6 - 2) \\times 180 = 720$."),
      hint("Two quick checks", "If you find that each interior angle of a regular polygon is $120^\\circ$, its exterior angle must be $180 - 120 = 60^\\circ$, and then $360 \\div 60 = 6$ sides: a hexagon. The two methods should always agree."),
      practice("Interior and exterior angles", 14),
      summary("Key ideas", "• Interior angle + adjacent exterior angle $= 180^\\circ$.\n• Sum of interior angles of an $n$-sided polygon $= (n-2) \\times 180^\\circ$.\n• Each interior angle of a regular $n$-gon $= \\dfrac{(n-2) \\times 180^\\circ}{n}$.\n• The exterior angles of a convex polygon add up to $360^\\circ$; each exterior angle of a regular $n$-gon is $\\dfrac{360^\\circ}{n}$."),
    ],
    practice: ["g7t1-ext-int-01", "g7t1-ext-int-06", "g7t1-ext-int-09", "g7t1-polygon-angles-01", "g7t1-polygon-angles-03", "g7t1-polygon-angles-06", "g7t1-polygon-angles-08", "g7t1-polygon-angles-11", "g7t1-polygon-angles-14", "g7t1-polygon-angles-17", "g7t1-polygon-angles-19", "g7t1-polygon-angles-20"],
  },
  // ------------------------------------------------------------------ Week 4
  {
    key: "g7t1-w4", week: 4, unit: "B", title: "Percentage Increase and Percentage Decrease",
    description: "Finding how much a quantity went up or down as a percent of its original value, and finding a new value after a percentage change.",
    objectives: ["Compute percentage increase and percentage decrease", "Find a new value after a given percentage increase or decrease", "Solve real-life problems about prices, populations and scores"],
    minutes: 45, skills: ["g7t1-pct-increase", "g7t1-pct-decrease"],
    teacherNote: "Aligned with the Budget of Work, Grade 7 Term 1 Week 4 (problems involving percentage increase and percentage decrease). See DepEd Lesson Exemplar Q1 Lesson 4 for the classroom activities.",
    blocks: [
      text("1. How much did it change?", "Prices go up, populations grow, scores drop. To say how big a change is, we compare the **change** with the **original value** and write it as a percent:\n\n$$\\text{percentage change} = \\frac{\\text{change}}{\\text{original value}} \\times 100\\%$$\n\nIf the new value is **greater** than the original, the change is an **increase**. If it is **smaller**, the change is a **decrease** (and we use the size of the drop)."),
      example("2. Worked example: percentage increase", "A student's score rose from 40 to 50. What is the percentage increase?", ["Increase $= 50 - 40 = 10$.", "Divide by the **original** value: $10 \\div 40 = 0.25$.", "Write as a percent: $0.25 \\times 100\\% = 25\\%$."], "The score increased by 25%."),
      check("Checkpoint: Increase", "A price rises from ₱200 to ₱250. What is the percentage increase?", ["20%", "25%", "50%", "250%"], "25%", "Increase = 50. $50 \\div 200 \\times 100\\% = 25\\%$. Always divide by the original value."),
      example("3. Worked example: percentage decrease", "A bag's price drops from ₱500 to ₱400. What is the percentage decrease?", ["Decrease $= 500 - 400 = 100$.", "Divide by the **original** value: $100 \\div 500 = 0.20$.", "As a percent: $20\\%$."], "The price decreased by 20%."),
      text("4. Finding the new value", "Sometimes the percent is given and you want the new value.\n\n• **Increase:** new value $=$ original $+$ (percent of original)\n• **Decrease:** new value $=$ original $-$ (percent of original)\n\nExample: ₱400 increased by 15%. The increase is $0.15 \\times 400 = 60$, so the new price is $400 + 60 = ₱460$."),
      example("5. Worked example: decrease by a percent", "A quantity of 800 is decreased by 35%. What is the new quantity?", ["Decrease $= 35\\%$ of $800 = 0.35 \\times 800 = 280$.", "New quantity $= 800 - 280$."], "The new quantity is 520."),
      check("Checkpoint: New value", "A ₱640 item is increased by 25%. What is the new price?", ["₱660", "₱800", "₱160", "₱665"], "₱800", "25% of 640 = 160, and 640 + 160 = 800."),
      hint("Common mistakes", "• Divide by the **original** value, not the new one.\n• A 50% drop followed by a 50% rise does **not** bring you back: from 100 down to 50, then up 50% of 50 gives 75.\n• Percentage change is not the same as the change itself: a rise from 40 to 60 is an increase of 20 in value, but a **50%** increase."),
      practice("Percentage increase and decrease", 14),
      summary("Key ideas", "• Percentage change $= \\dfrac{\\text{change}}{\\text{original}} \\times 100\\%$.\n• Increase if the new value is larger; decrease if it is smaller.\n• New value after an increase $=$ original $+$ percent of original; after a decrease $=$ original $-$ percent of original."),
    ],
    practice: ["g7t1-pct-increase-01", "g7t1-pct-increase-03", "g7t1-pct-increase-07", "g7t1-pct-increase-10", "g7t1-pct-increase-11", "g7t1-pct-decrease-01", "g7t1-pct-decrease-03", "g7t1-pct-decrease-07", "g7t1-pct-decrease-09", "g7t1-pct-decrease-10", "g7t1-pct-decrease-11", "g7t1-pct-decrease-12"],
  },
  // ------------------------------------------------------------------ Week 5
  {
    key: "g7t1-w5", week: 5, unit: "B", title: "Money Problems with Percentages and a Daily Financial Plan",
    description: "Discounts and sale prices, commission, sales tax (VAT) and simple interest, and planning a day's money with a simple budget.",
    objectives: ["Define discount, sale price, commission, sales tax and simple interest", "Solve money problems that use percentages", "Create a simple daily financial plan with income, expenses and savings"],
    minutes: 50, skills: ["g7t1-money-discount", "g7t1-money-commission", "g7t1-money-interest", "g7t1-money-budget"],
    teacherNote: "Aligned with the Budget of Work, Grade 7 Term 1 Week 4-5 (money problems involving percentages such as discount, commission, sales tax and simple interest; create a financial plan). See DepEd Lesson Exemplar Q1 Lesson 5 for the classroom activities, including the group budgeting task.",
    blocks: [
      text("1. Percent and money", "Percentages appear whenever money is involved:\n\n• **Discount**: the amount taken off the original price. **Sale price**: the price after the discount.\n• **Commission**: money a seller earns, as a percent of the sales.\n• **Sales tax (VAT)**: a percent of the price that is **added** when you buy.\n• **Simple interest**: money earned (or paid) for keeping (or borrowing) money for some time."),
      text("2. Discount and sale price", "$$\\text{discount} = \\text{original price} \\times \\text{discount rate}$$\n$$\\text{sale price} = \\text{original price} - \\text{discount}$$"),
      example("3. Worked example: sale price", "A pair of shoes costs ₱800 and is on sale at 25% off. Find the discount and the sale price.", ["Discount $= 800 \\times 0.25 = 200$.", "Sale price $= 800 - 200 = 600$."], "The discount is ₱200 and the sale price is ₱600."),
      check("Checkpoint: Discount", "A ₱360 item has a 15% discount. How much is the discount?", ["₱15", "₱36", "₱54", "₱306"], "₱54", "15% of 360 = 0.15 × 360 = 54. (The sale price would be 360 − 54 = ₱306.)"),
      text("3b. Commission and sales tax", "$$\\text{commission} = \\text{sales} \\times \\text{commission rate}$$\n$$\\text{sales tax} = \\text{price} \\times \\text{tax rate}, \\qquad \\text{total paid} = \\text{price} + \\text{sales tax}$$"),
      example("4. Worked example: commission", "An agent sells a house for ₱250,000 and earns a 3% commission. How much is the commission?", ["Commission $= 250{,}000 \\times 0.03$.", "$250{,}000 \\times 0.03 = 7{,}500$."], "The commission is ₱7,500."),
      example("5. Worked example: sales tax", "An item costs ₱1,500 before 12% VAT. How much do you pay in all?", ["Tax $= 1{,}500 \\times 0.12 = 180$.", "Total $= 1{,}500 + 180$."], "You pay ₱1,680."),
      text("6. Simple interest", "$$I = P \\times r \\times t$$\n\n$I$ is the interest, $P$ the **principal** (the money invested or borrowed), $r$ the yearly rate **as a decimal**, and $t$ the time in **years**."),
      example("7. Worked example: simple interest", "₱5,000 is invested at 6% simple interest per year for 2 years. Find the interest and the total amount.", ["$I = 5{,}000 \\times 0.06 \\times 2 = 600$.", "Total $= 5{,}000 + 600$."], "The interest is ₱600 and the total amount is ₱5,600."),
      check("Checkpoint: Interest", "₱10,000 at 4% simple interest per year for 3 years earns", ["₱400", "₱1,200", "₱1,400", "₱12,000"], "₱1,200", "$I = 10{,}000 \\times 0.04 \\times 3 = 1{,}200$."),
      text("8. A daily financial plan", "A financial plan helps you decide **before** you spend. Write down:\n\n1. your **income** for the day (allowance),\n2. your planned **expenses** (food, fare, school needs),\n3. what is left to **save**.\n\n$$\\text{savings} = \\text{income} - \\text{total planned expenses}$$\n\nSome people decide to save a percent of their income first. For a ₱350 allowance, saving 20% means setting aside $0.20 \\times 350 = ₱70$, leaving ₱280 to spend."),
      example("9. Worked example: a one-day plan", "Mia's allowance is ₱200. She plans ₱60 for food, ₱40 for fare and ₱30 for school needs. How much can she save?", ["Total planned expenses $= 60 + 40 + 30 = 130$.", "Savings $= 200 - 130$."], "Mia can save ₱70, which is 35% of her allowance."),
      hint("Try your own plan", "On paper, write your own one-day plan: your income, three or four expenses and your savings. Then write the **formula** for your plan, for example $\\text{savings} = \\text{allowance} - (\\text{food} + \\text{fare} + \\text{other})$, and test it with your numbers."),
      practice("Money problems with percentages", 16),
      summary("Key ideas", "• Discount $=$ original price $\\times$ rate; sale price $=$ original price $-$ discount.\n• Commission $=$ sales $\\times$ commission rate.\n• Sales tax $=$ price $\\times$ tax rate, and it is added to the price.\n• Simple interest $I = P \\times r \\times t$ (rate as a decimal, time in years).\n• Savings $=$ income $-$ planned expenses."),
    ],
    practice: ["g7t1-money-discount-01", "g7t1-money-discount-02", "g7t1-money-discount-09", "g7t1-money-commission-01", "g7t1-money-commission-05", "g7t1-money-commission-08", "g7t1-money-interest-01", "g7t1-money-interest-05", "g7t1-money-interest-06", "g7t1-money-budget-01", "g7t1-money-budget-02", "g7t1-money-budget-04"],
  },
  // ------------------------------------------------------------------ Week 6
  {
    key: "g7t1-w6", week: 6, unit: "B", title: "Rates and Unit Rates",
    description: "What a rate is, how to write a rate as a unit rate, and how to solve problems about speed, price per unit and work done per time.",
    objectives: ["Define and identify rates and unit rates", "Explain uses of rates in everyday life", "Express a rate as a unit rate", "Solve problems involving rates, including speed"],
    minutes: 45, skills: ["g7t1-rate-identify", "g7t1-rate-unit", "g7t1-rate-problems"],
    teacherNote: "Aligned with the Budget of Work, Grade 7 Term 1 Week 6 (identify and explain the uses of rates; solve problems involving rates, e.g. speed). See DepEd Lesson Exemplar Q1 Lesson 6 for the classroom activities.",
    blocks: [
      text("1. Rates are everywhere", "₱45 for 3 kilograms of rice. 120 kilometers in 2 hours. 6 pages in 3 days. Each of these compares **two different kinds of quantities** (pesos and kilograms, kilometers and hours, pages and days). A comparison like this is a **rate**.\n\nA **ratio** can compare quantities with the same kind of unit (3 boys to 5 girls). A **rate** compares quantities with **different units**."),
      text("2. Unit rates", "A **unit rate** is a rate whose second quantity is **1**: ₱15 **per** kilogram, 60 kilometers **per** hour, 2 pages **per** day.\n\nTo write a rate as a unit rate, **divide the first quantity by the second**: $\\dfrac{₱45}{3\\ \\text{kg}} = ₱15$ per kg."),
      check("Checkpoint: Rate or ratio?", "Which one is a rate?", ["4 boys to 5 girls", "₱60 for 4 kilograms", "A triangle has 3 sides", "The class has 40 students"], "₱60 for 4 kilograms", "Pesos and kilograms are different units, so it compares two kinds of quantities: a rate."),
      example("3. Worked example: unit rate", "A bus travels 150 kilometers in 3 hours. What is its unit rate (speed)?", ["Divide the distance by the time.", "$150 \\div 3 = 50$."], "The speed is 50 kilometers per hour."),
      text("3b. Why unit rates are useful", "Unit rates let you **compare** offers fairly. Which is cheaper, ₱84 for 6 pieces or ₱120 for 10 pieces? Find the price **per piece** for each: $84 \\div 6 = 14$ and $120 \\div 10 = 12$. The second offer costs ₱12 per piece, so it is cheaper."),
      text("4. Speed, distance and time", "Speed is a rate: distance per time.\n\n$$\\text{speed} = \\frac{\\text{distance}}{\\text{time}}, \\qquad \\text{distance} = \\text{speed} \\times \\text{time}, \\qquad \\text{time} = \\frac{\\text{distance}}{\\text{speed}}$$"),
      example("5. Worked example: using a unit rate", "Jim writes 10 pages in 4 hours. At this rate, how many pages can he write in 6 hours?", ["Find the unit rate: $10 \\div 4 = 2.5$ pages per hour.", "Multiply by the number of hours: $2.5 \\times 6 = 15$."], "Jim can write 15 pages in 6 hours."),
      example("6. Worked example: time", "How long does it take to travel 180 km at 60 km/h?", ["Time $=$ distance $\\div$ speed.", "$180 \\div 60 = 3$."], "It takes 3 hours."),
      check("Checkpoint: Distance", "A van travels at 45 km/h for 3 hours. How far does it go?", ["15 km", "48 km", "135 km", "145 km"], "135 km", "Distance = speed × time = 45 × 3 = 135 km."),
      hint("Check your units", "Always write the units in your answer: ₱ per kg, km per hour, pages per day. If the units do not make sense (for example hours per kilometer when you wanted speed), you divided the wrong way around."),
      practice("Rates and unit rates", 14),
      summary("Key ideas", "• A **rate** compares two quantities with different units; a **unit rate** has 1 as its second quantity.\n• To find a unit rate, divide the first quantity by the second.\n• Speed $= \\dfrac{\\text{distance}}{\\text{time}}$; distance $=$ speed $\\times$ time; time $=$ distance $\\div$ speed.\n• Unit rates make it easy to compare offers and to scale up (multiply the unit rate)."),
    ],
    practice: ["g7t1-rate-identify-01", "g7t1-rate-identify-02", "g7t1-rate-identify-04", "g7t1-rate-unit-01", "g7t1-rate-unit-02", "g7t1-rate-unit-06", "g7t1-rate-unit-07", "g7t1-rate-problems-01", "g7t1-rate-problems-04", "g7t1-rate-problems-07", "g7t1-rate-problems-10", "g7t1-rate-problems-11"],
  },
];

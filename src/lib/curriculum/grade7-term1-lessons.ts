/**
 * Lessons for Grade 7 Term 1, weeks 1-6 (original text written for this platform; scope follows the DepEd MATATAG Grade 7
 * Mathematics Budget of Work). Math in $...$ is rendered with KaTeX by the lesson player.
 */
import type { SeedLesson } from "./grade7-term1-types";
import { regularPolygonsDiagram, constructionDiagram } from "./grade7-term1-diagrams";
import { text, hint, summary, image, example, check, practice } from "./grade7-term1-blocks";
import { GRADE7_TERM1_DAILY_LESSONS } from "./grade7-term1-days";

/**
 * Week 1 is kept as a DRAFT that students cannot see: the Lesson Exemplar for Q1 Lesson 1 has not been supplied, so its day-by-day content
 * is unknown. This one-lesson-for-the-week text goes beyond the Budget of Work competency (it also defines and names polygons and uses a
 * compass). It is replaced by daily lessons when the exemplar arrives (docs/BOW_LE_ALIGNMENT.md).
 */
const WEEK1_AWAITING_EXEMPLAR: SeedLesson[] = [
  // ------------------------------------------------------------------ Week 1
  {
    key: "g7t1-w1", week: 1, unit: "A", published: false, title: "Polygons: Naming, Regular and Irregular, and Drawing Them",
    description: "What a polygon is, how polygons are named by their sides, how regular and irregular polygons differ, and how to draw regular polygons with a compass, protractor and ruler.",
    objectives: ["Define a polygon and tell polygons from non-polygons", "Name polygons with 3 to 10 sides", "Classify polygons as regular or irregular", "Draw regular polygons with 5, 6, 8 or 10 sides using a compass, protractor and ruler"],
    minutes: 45, skills: ["g7t1-poly-define", "g7t1-poly-names", "g7t1-poly-regular", "g7t1-poly-construct"],
    teacherNote: "NOT PUBLISHED: waiting for the Lesson Exemplar for Q1 Lesson 1. Aligned with the Budget of Work, Grade 7 Term 1 Week 1 (draw and describe regular and irregular polygons with 5, 6, 8 or 10 sides). The DepEd Lesson Exemplar Q1 Lesson 1 has the classroom procedure and group activities; this online lesson adds practice and tutoring and does not replace the drawing work with real instruments.",
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
];

/** Week 1 (hidden until its exemplar is supplied) followed by one lesson per day for Weeks 2-6. */
export const GRADE7_TERM1_LESSONS: SeedLesson[] = [...WEEK1_AWAITING_EXEMPLAR, ...GRADE7_TERM1_DAILY_LESSONS];

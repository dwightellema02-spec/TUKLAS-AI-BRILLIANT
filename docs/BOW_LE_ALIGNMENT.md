# Budget of Work and Lesson Exemplar alignment (Grade 7 Mathematics, Term 1, Weeks 1-6)

Sources supplied by the school: the DepEd MATATAG Grade 7 Three-Term Budget of Work (BOW) and the Lesson Exemplars (LE) for Q1 Lessons 1-6. A week has several days, so the platform has **one lesson per day of each exemplar** and each lesson teaches only what its day teaches. The exemplars are restricted teacher materials: their wording is **not** copied; topics, order and objectives are followed and the text, examples and questions are original.

## Week and day map
| Week | BOW competency (paraphrased) | Day | Lesson (what the day teaches) |
|---|---|---|---|
| 1 | Draw and describe regular and irregular polygons with 5, 6, 8 or 10 sides using a ruler and protractor; draw triangles, quadrilaterals and regular polygons with given angles | 1 | Define a polygon; name polygons by sides; name a polygon, its sides and interior angles by its vertices |
| | | 2 | Regular and irregular polygons with 5, 6, 8 or 10 sides: equilateral, equiangular, regular, irregular; angle measures 108°, 120°, 135°, 144° |
| | | 3 | Drawing regular polygons with a ruler, protractor and compass (angle at the center 360° ÷ n) *(Day 3 of the exemplar's Days 3-4 sub-topic)* |
| | | 4 | Drawing triangles and quadrilaterals; the table of sides, angles and sums; review and check *(Day 4 of that sub-topic)* |
| 2 | Angle pairs; classify polygons as regular or irregular and convex or non-convex | 1 | Convex and non-convex polygons |
| | | 2 | Angle pairs: complementary, supplementary, adjacent *(Day 2 of the exemplar's Days 2-3 sub-topic)* |
| | | 3 | Angle pairs: linear pair and vertical angles *(Day 3 of that sub-topic)* |
| | | 4 | Review and check |
| 3 | Exterior angle and adjacent interior angle; angle measures and number of sides of polygons | 1 | Exterior and interior angles; pairing and measuring them |
| | | 2 | The relationship between an exterior angle and its adjacent interior angle (supplementary) |
| | | 3 | Angle measures and number of sides of polygons: the sum (n - 2) × 180°, a missing angle, n from the sum |
| | | 4 | Regular polygons: each interior and exterior angle, n from an angle |
| | | 5 | Review and check |
| 4 | Percentage increase and decrease *(the BOW also lists money problems here; see below)* | 1 | Percentage increase *(Day 1 of the exemplar's Days 1-2 sub-topic)* |
| | | 2 | Percentage increase in real-life problems; new value after an increase *(Day 2)* |
| | | 3 | Percentage decrease *(Day 3 of Days 3-4)* |
| | | 4 | Percentage decrease in real-life problems; going backwards; review *(Day 4)* |
| 5 | Money problems with percentages; create a financial plan | 1 | Discount and sale price (also the original price and the discount rate) |
| | | 2 | Commission and sales tax (VAT) |
| | | 3 | Simple interest: interest, principal, rate, time |
| | | 4 | Creating a one-day financial plan |
| 6 | Identify and explain the uses of rates; solve problems involving rates (e.g. speed) | 1 | Identify and explain the uses of rates (ratio versus rate, unit rate) |
| | | 2 | Express rates as unit rates |
| | | 3 | Solve problems involving rates (unit rate, then multiply; speed; comparing offers) |
| | | 4 | Review and check |

Where an exemplar gives a sub-topic two days and does not say how to divide them (Week 1 Days 3-4, Week 2 Days 2-3, Week 4 Days 1-2 and 3-4), the split above is the platform's; each such teacher note says so.

## Differences between the documents (decisions to confirm)
1. **Money problems: Week 4 or Week 5?** The BOW lists "money problems involving percentages (discount, commission, sales tax, simple interest)" under Week 4 and "create a financial plan" under Week 5. The exemplars teach percentage increase and decrease in Week 4 and **all** the money problems plus the financial plan in Week 5. The platform follows the **exemplars**.
2. **Week 1 pentagon from a circle.** The exemplar draws a regular pentagon from a circle of radius 2 cm and calls its side 2 cm. That is true only for the hexagon (side = radius). The lessons say to measure the sides with a ruler (only the hexagon's side equals the radius).

## Not built
* **Term 1, Weeks 7-10** (BOW): rational numbers, ordering, operations, square and cube roots, irrational numbers. No exemplars were supplied for these weeks.

## What was removed or added in the question bank (Weeks 1-6)
* Removed as beyond the exemplars: side of a regular polygon from its perimeter (4), regular nonagon and 12-gon angles (2), two supplementary angles in a ratio, two complementary angles x and 2x, a 50% fall then rise, and the total amount after simple interest.
* Added so every part of the exemplars has questions: exterior angle identification (2), the interior angle of a regular pentagon and octagon, regular polygon in words, equal sides of a regular pentagon, original price from a sale price (2), principal and rate in simple interest (2).

## How it is checked
`npm run test:phase49` (`scripts/test-phase49-alignment.ts`): 25 daily lessons in order; every lesson names the topics of its day; no lesson mentions a topic from a later day or a later week (or outside the exemplars); each day's practice questions stay inside the day; the removed questions are not in the bank. It fails if a lesson combines topics, which was confirmed by deliberately adding a topic from another day.

## Teachers
These lessons are a first draft aligned to the documents: a teacher should read each lesson against the exemplar before students use it, and add lesson videos day by day.

## Phase 50: see it, then do it

Every one of the 25 daily lessons now has at least one illustration (inline SVG, `grade7-term1-diagrams*.ts`) placed beside the worked example it explains, and at least 3 checkpoint quizzes, including a "Your turn" question with different numbers after worked examples. Checkpoints are graded on the server. `scripts/test-phase49-alignment.ts` enforces both minimums. Content stays inside each day's Lesson Exemplar scope. The answers were checked by hand and by the existing numeric recomputation; no teacher has reviewed them yet.

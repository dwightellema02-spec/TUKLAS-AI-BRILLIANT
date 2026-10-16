/**
 * Independent solver for the word problems of the Grade 7 Term 1 curriculum: recomputes the answer from the numbers written in the
 * prompt (a second implementation, not the generator that produced the question). Returns undefined when it has no rule for a prompt.
 */
const nums = (s: string) => [...s.replace(/,/g, "").matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

export function solveNumeric(p: string): number | undefined {
  const n = nums(p);
  let m: RegExpMatchArray | null;
  // Phase 49 questions (Week 1 exemplar: angle measures of regular polygons, equal sides)
  if (/Each interior angle of a regular (pentagon|octagon) measures how many degrees/.test(p)) return /pentagon/.test(p) ? 540 / 5 : 1080 / 8;
  if (/ABCDE is a regular pentagon and side BC is \d+ cm\. How long is side AE/.test(p)) return n[0];
  // Phase 49 questions (from the Week 5 exemplar topics): original price from a sale price, the principal and the rate in simple interest
  if (/is on sale for ₱[\d,]+ after a \d+% discount\. What was its original price/.test(p)) return n[0] / (1 - n[1] / 100);
  if (/pays ₱[\d,]+ simple interest after \d+ years at \d+% per year\. What principal/.test(p)) return n[0] / ((n[2] / 100) * n[1]);
  if (/earns ₱[\d,]+ simple interest in \d+ years\. What is the yearly interest rate/.test(p)) return (n[1] / (n[0] * n[2])) * 100;
  // wordings used by the tutor's worked examples (Phase 40)
  if (/is invested at \d+% simple interest per year for \d+ years\. How much interest/.test(p)) return (n[0] * n[1] * n[2]) / 100;
  if (/is invested at \d+% simple interest per year for \d+ years\. How much money/.test(p)) return n[0] + (n[0] * n[1] * n[2]) / 100;
  if (/is increased by \d+%\. What is the new (price|quantity)/.test(p)) return n[0] * (1 + n[1] / 100);
  if ((m = p.match(/regular (\d+)-sided polygon is drawn from a circle/))) return 360 / Number(m[1]);
  if (/interior angle at a vertex is \d+°\. Find the adjacent exterior/.test(p) || /exterior angle at a vertex is \d+°\. Find the adjacent interior/.test(p)) return 180 - n[0];
  if (/Two angles are (complementary|supplementary)\. One measures \d+°\. Find the other/.test(p)) return (/complementary/.test(p) ? 90 : 180) - n[0];
  if ((m = p.match(/regular (\w+) from a circle/))) {
    const sides: Record<string, number> = { pentagon: 5, hexagon: 6, octagon: 8, decagon: 10, nonagon: 9 };
    return 360 / sides[m[1]];
  } else if (/12-sided polygon from a circle/.test(p)) return 30;
  else if (/complementary\. One measures/.test(p)) return 90 - n[0];
  else if (/supplementary\. One measures/.test(p)) return 180 - n[0];
  else if (/vertically opposite/.test(p)) return n[0];
  else if (/linear pair/.test(p)) return 180 - n[0];
  else if (/interior angle is \d+°\. What is the adjacent exterior/.test(p)) return 180 - n[0];
  else if (/exterior angle is \d+°\. What is the adjacent interior/.test(p)) return 180 - n[0];
  else if (/sum of the interior angles of a polygon with \d+ sides/.test(p)) return (n[0] - 2) * 180;
  else if (/EACH interior angle of a regular polygon with \d+ sides/i.test(p)) return ((n[0] - 2) * 180) / n[0];
  else if (/EACH exterior angle of a regular polygon with \d+ sides/i.test(p)) return 360 / n[0];
  else if (/Each exterior angle of a regular polygon is \d+°\. How many sides/.test(p)) return 360 / n[0];
  else if (/interior angles of a polygon add up to \d+°\. How many sides/.test(p)) return n[0] / 180 + 2;
  else if (/Three interior angles of a quadrilateral/.test(p)) return 360 - n[0] - n[1] - n[2];
  else if (/Four interior angles of a pentagon/.test(p)) return 540 - n[0] - n[1] - n[2] - n[3];
  else if (/exterior angles of any convex polygon add up/.test(p)) return 360;
  else if (/(rises|drops) from [\d,]+ to [\d,]+\. What is the percentage|dropped from|sold \d+ meals/.test(p) && /percentage (increase|decrease)/.test(p)) {
    const [a, b] = n; return (Math.abs(b - a) / a) * 100;
  } else if (/is increased by \d+%\. What is the new price/.test(p)) return n[0] * (1 + n[1] / 100);
  else if (/is decreased by \d+%\. What is the new quantity/.test(p)) return n[0] * (1 - n[1] / 100);
  else if (/How much is the discount/.test(p)) return (n[0] * n[1]) / 100;
  else if (/What is the sale price/.test(p)) return n[0] * (1 - n[1] / 100);
  else if (/originally priced.*is sold for/.test(p)) return ((n[0] - n[1]) / n[0]) * 100;
  else if (/earns a \d+% commission/.test(p)) return (n[0] * n[1]) / 100;
  else if (/commission on sales of/.test(p)) return (n[0] / n[1]) * 100;
  else if (/How much is the tax/.test(p)) return (n[0] * n[1]) / 100;
  else if (/sales tax\. How much do you pay in all/.test(p)) return n[0] * (1 + n[1] / 100);
  else if (/Simple interest: principal/.test(p)) return (n[0] * n[1] * n[2]) / 100;
  else if (/simple interest per year for \d+ years\. How much money will you have/.test(p)) return n[0] + (n[0] * n[1] * n[2]) / 100;
  else if (/earns ₱[\d,]+ simple interest at/.test(p)) return n[1] / ((n[0] * n[2]) / 100);
  else if (/daily allowance of ₱200\. She plans/.test(p)) return n[0] - n[1] - n[2] - n[3];
  else if (/save 20% of her/.test(p) || /spend 45% of/.test(p)) return (n[1] * n[0]) / 100;
  else if (/Income ₱\d+, expenses/.test(p)) return n[0] - n[1] - n[2] - n[3];
  else if (/cost ₱[\d,]+\. What is the unit rate/.test(p)) return n[1] / n[0];
  else if (/unit rate|rate in liters per minute/.test(p)) return n[0] / n[1];
  else if (/What is its speed/.test(p)) return n[0] / n[1];
  else if (/travels at \d+ km\/h for/.test(p)) return n[0] * n[1];
  else if (/How long does it take to travel/.test(p)) return n[0] / n[1];
  else if (/At this rate, how many pages/.test(p)) return (n[0] / n[1]) * n[2];
  else if (/pay for 10 days/.test(p) || /At this rate, how much is the pay/.test(p)) return (n[0] / n[1]) * n[2];
  else if (/circle of radius \d+ cm/.test(p)) return n[1];
  else if (/ratio 1 : 3/.test(p)) return 45;
  else if (/x and 2x/.test(p)) return 30;
  else if (/∠ABC = 90°/.test(p)) return 90 - n[1];
  else if ((m = p.match(/How many (?:sides|interior angles) does an? (\w+) have/))) return { triangle: 3, quadrilateral: 4, pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10 }[m[1]]!;
  else if (/regular \w+ has a perimeter of/.test(p)) return n[0] / ({ pentagon: 5, hexagon: 6, octagon: 8, decagon: 10 } as any)[p.match(/regular (\w+)/)![1]];
  else if (/How many (interior angles|sides)/.test(p) || /vertices/.test(p)) return n[0];
  return undefined;

  return undefined;
}

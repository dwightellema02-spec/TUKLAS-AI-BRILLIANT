/**
 * Phase 22: Text cleaning. Conservative on purpose: it must never alter mathematical content.
 */

function normalizePage(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/ /g, " ")
    .replace(/[​-‍﻿]/g, "")
    // Re-join words hyphenated across a line break ("inte-\nger" -> "integer"), letters only.
    .replace(/([A-Za-z]{2,})-\n([a-z]{2,})/g, "$1$2")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Remove running headers/footers: short lines that sit in the first/last two lines of most pages.
 * Body lines are never touched, even when they repeat. Only applied to multi-page documents.
 */
const EDGE_LINES = 2;
// Structural headings that legitimately open pages are never boilerplate.
const STRUCTURAL_HEADING = /^\s*(lesson|activity|example|exercise|answer|solutions?|practice|summary|objectives?|assessment|reflection)\b/i;

function stripRepeatedBoilerplate(pages: string[]): string[] {
  if (pages.length < 4) return pages;

  const normalizeLine = (l: string) => l.trim().replace(/\d+/g, "#").toLowerCase();
  const edgeLines = (page: string): Set<string> => {
    const lines = page.split("\n").filter((l) => l.trim().length > 0);
    const edge = [...lines.slice(0, EDGE_LINES), ...lines.slice(-EDGE_LINES)];
    return new Set(edge.map(normalizeLine).filter((k) => k.length > 0 && k.length <= 80 && !STRUCTURAL_HEADING.test(k)));
  };

  const counts = new Map<string, number>();
  for (const page of pages) {
    for (const key of edgeLines(page)) counts.set(key, (counts.get(key) || 0) + 1);
  }

  const threshold = Math.ceil(pages.length * 0.6);
  const boilerplate = new Set([...counts.entries()].filter(([, c]) => c >= threshold).map(([k]) => k));
  if (boilerplate.size === 0) return pages;

  return pages.map((page) => {
    const lines = page.split("\n");
    const nonEmptyIdx = lines.map((l, i) => (l.trim().length > 0 ? i : -1)).filter((i) => i !== -1);
    const edgeIdx = new Set([...nonEmptyIdx.slice(0, EDGE_LINES), ...nonEmptyIdx.slice(-EDGE_LINES)]);
    return lines
      .filter((line, i) => !(edgeIdx.has(i) && boilerplate.has(normalizeLine(line))))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  });
}

export function cleanPages(pages: string[]): string[] {
  return stripRepeatedBoilerplate(pages.map(normalizePage));
}

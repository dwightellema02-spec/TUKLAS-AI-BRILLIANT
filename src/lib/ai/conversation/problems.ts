/**
 * Phase 23/24: Deterministic problem and worked-example generation.
 * Every number the tutor poses or solves comes from here, never from an LLM, so correctness is guaranteed.
 * Supported kinds: two-number integer arithmetic, absolute value, opposites, one-step equations, comparisons.
 */

import { displayProblem, fmt, wrapNum } from "./arith";
import type { Operator, ParsedProblem, ProblemKindTag } from "./types";

export type ProblemKind = "TRANSFER" | "SIMPLER" | "HARDER";

/** Small deterministic PRNG so the same state always yields the same problem (testable). */
function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function kindOf(p: ParsedProblem): ProblemKindTag {
  if (p.kind) return p.kind;
  switch (p.op) {
    case "abs": return "ABS";
    case "opp": return "OPPOSITE";
    case "x+":
    case "x-": return "EQUATION";
    case "max":
    case "min":
    case ">":
    case "<": return "COMPARE";
    default: return "BINARY";
  }
}

export function problemKey(p: ParsedProblem): string {
  return `${p.a}|${p.op}|${p.b}`;
}

export function sameProblem(x?: ParsedProblem, y?: ParsedProblem): boolean {
  return !!x && !!y && problemKey(x) === problemKey(y);
}

function compute(a: number, op: Operator, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return a / b;
    case "abs": return Math.abs(a);
    case "opp": return a === 0 ? 0 : -a;
    case "x+": return b - a;
    case "x-": return b + a;
    case "max": return Math.max(a, b);
    case "min": return Math.min(a, b);
    case ">": return a > b ? 1 : 0;
    case "<": return a < b ? 1 : 0;
  }
}

export function makeProblem(a: number, op: Operator, b: number = 0, variable = "x"): ParsedProblem {
  const expected = compute(a, op, b);
  switch (op) {
    case "abs": return { kind: "ABS", a, b: 0, op, expected, display: `|${a}|` };
    case "opp": return { kind: "OPPOSITE", a, b: 0, op, expected, display: `the opposite of ${wrapNum(a)}` };
    case "x+": return { kind: "EQUATION", a, b, op, variable, expected, display: `${variable} + ${wrapNum(a)} = ${b}` };
    case "x-": return { kind: "EQUATION", a, b, op, variable, expected, display: `${variable} − ${wrapNum(a)} = ${b}` };
    case "max":
    case "min": return { kind: "COMPARE", a, b, op, expected, display: `which is ${op === "max" ? "greater" : "less"}: ${wrapNum(a)} or ${wrapNum(b)}` };
    case ">":
    case "<": return { kind: "COMPARE", a, b, op, expected, display: `${wrapNum(a)} ${op} ${wrapNum(b)}` };
    default: return { kind: "BINARY", a, b, op, expected, display: displayProblem(a, op, b) };
  }
}

/** Text for showing the problem to a student: LaTeX for expressions, plain words otherwise. */
export function mathText(p: ParsedProblem): string {
  const k = kindOf(p);
  if (k === "OPPOSITE" || (k === "COMPARE" && (p.op === "max" || p.op === "min"))) return p.display;
  return `$${p.display.replace("×", "\\times").replace("÷", "\\div").replace("−", "-")}$`;
}

/** The numbers a posed problem must contain (used to check that the tutor posed exactly the right problem). */
export function problemNumbers(p: ParsedProblem): number[] {
  switch (kindOf(p)) {
    case "ABS":
    case "OPPOSITE": return [p.a];
    default: return [p.a, p.b];
  }
}

/** The single answer value for a problem as the student would type it. */
export function answerText(p: ParsedProblem): string {
  if (p.op === ">" || p.op === "<") return p.expected === 1 ? "true" : "false";
  return fmt(p.expected);
}

/**
 * New problem of the same kind and sign pattern as `original` (so it exercises the same idea) but with
 * different numbers. `avoid` lists problem keys that must not be reused.
 */
export function generateRelatedProblem(original: ParsedProblem, kind: ProblemKind, seed: number, avoid: string[] = []): ParsedProblem {
  const rand = rng(seed ^ hashString(problemKey(original)) ^ hashString(kind));
  const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const range: [number, number] = kind === "SIMPLER" ? [1, 9] : kind === "HARDER" ? [12, 45] : [2, 19];
  const sa = original.a < 0 ? -1 : 1;
  const sb = original.b < 0 ? -1 : 1;
  const forbidden = new Set([problemKey(original), ...avoid]);
  const tag = kindOf(original);

  for (let attempt = 0; attempt < 300; attempt++) {
    let p: ParsedProblem | undefined;

    if (tag === "ABS") {
      p = makeProblem(sa * pick(range[0], range[1]), "abs");
    } else if (tag === "OPPOSITE") {
      p = makeProblem(sa * pick(range[0], range[1]), "opp");
    } else if (tag === "EQUATION") {
      // Keep the shape (x + a or x - a) and the sign of a and of the solution; choose b so the solution is an integer.
      const sol = (original.expected < 0 ? -1 : 1) * pick(range[0], range[1]);
      const a = sa * pick(kind === "HARDER" ? 6 : 2, kind === "SIMPLER" ? 9 : range[1]);
      const b = original.op === "x+" ? sol + a : sol - a;
      p = makeProblem(a, original.op, b, original.variable ?? "x");
    } else if (tag === "COMPARE") {
      // Transfers are "which is greater/less" (a number answer, so a lucky true/false guess cannot pass).
      const a = sa * pick(range[0], range[1]);
      const b = sb * pick(range[0], range[1]);
      if (a === b) continue;
      const wantMax = original.op === "max" || original.op === ">" || original.op === undefined;
      p = makeProblem(a, wantMax ? "max" : "min", b);
    } else if (original.op === "/") {
      const mb = kind === "HARDER" ? pick(6, 12) : pick(2, 9);
      const q = kind === "HARDER" ? pick(6, 12) : pick(2, 9);
      p = makeProblem(sa * mb * q, "/", sb * mb);
    } else if (original.op === "*") {
      p = makeProblem(
        sa * (kind === "HARDER" ? pick(7, 15) : kind === "SIMPLER" ? pick(2, 6) : pick(2, 9)),
        "*",
        sb * (kind === "HARDER" ? pick(6, 12) : kind === "SIMPLER" ? pick(2, 6) : pick(2, 9))
      );
    } else {
      const a = sa * pick(range[0], range[1]);
      const b = sb * pick(range[0], range[1]);
      if (Math.abs(a) === Math.abs(b)) continue; // mixed-sign add/subtract: avoid a zero result
      p = makeProblem(a, original.op, b);
    }

    if (forbidden.has(problemKey(p))) continue;
    if (p.expected === original.expected && tag !== "COMPARE") continue; // a memorised answer must not pass
    if (p.expected === 0) continue;
    return p;
  }
  return makeProblem(7, "+", -3);
}

export function opWord(op: Operator): string {
  switch (op) {
    case "+": return "addition";
    case "-": return "subtraction";
    case "*": return "multiplication";
    case "/": return "division";
    default: return "this kind of problem";
  }
}

/** Facts that describe a two-number problem's structure WITHOUT stating the result. */
export function structureFacts(p: ParsedProblem) {
  const absA = Math.abs(p.a);
  const absB = Math.abs(p.b);
  const sameSigns = Math.sign(p.a) === Math.sign(p.b);
  const larger = absA >= absB ? p.a : p.b;
  const smaller = absA >= absB ? p.b : p.a;
  return {
    absA,
    absB,
    sameSigns,
    larger,
    smaller,
    largerAbs: Math.abs(larger),
    smallerAbs: Math.abs(smaller),
    signOfLarger: larger < 0 ? "negative" : "positive",
  };
}

/** Fully worked solution steps for `p` (used ONLY for analogous examples, never for the active problem). */
export function workedSteps(p: ParsedProblem): string[] {
  const k = kindOf(p);
  if (k === "ABS") {
    return [
      `The absolute value of a number is its distance from zero on the number line. ${p.a} is ${Math.abs(p.a)} unit${Math.abs(p.a) === 1 ? "" : "s"} away from 0.`,
      `Distance is never negative, so |${p.a}| = ${p.expected}.`,
    ];
  }
  if (k === "OPPOSITE") {
    return [
      `The opposite of a number is the number the same distance from zero on the other side of 0.`,
      `${p.a} is ${Math.abs(p.a)} away from 0, so its opposite is on the other side: the opposite of ${wrapNum(p.a)} = ${fmt(p.expected)}.`,
    ];
  }
  if (k === "EQUATION") {
    const v = p.variable ?? "x";
    if (p.op === "x+") {
      return [
        `To get ${v} alone, undo "+ ${wrapNum(p.a)}" by subtracting ${wrapNum(p.a)} from both sides: ${v} = ${p.b} − ${wrapNum(p.a)}.`,
        `${p.b} − ${wrapNum(p.a)} = ${fmt(p.expected)}, so ${v} = ${fmt(p.expected)}.`,
      ];
    }
    return [
      `To get ${v} alone, undo "− ${wrapNum(p.a)}" by adding ${wrapNum(p.a)} to both sides: ${v} = ${p.b} + ${wrapNum(p.a)}.`,
      `${p.b} + ${wrapNum(p.a)} = ${fmt(p.expected)}, so ${v} = ${fmt(p.expected)}.`,
    ];
  }
  if (k === "COMPARE") {
    const greater = Math.max(p.a, p.b);
    const lesser = Math.min(p.a, p.b);
    const target = p.op === "min" || p.op === "<" ? lesser : greater;
    return [
      `On a number line, numbers farther to the right are greater. Place ${wrapNum(p.a)} and ${wrapNum(p.b)} on the line.`,
      `${fmt(greater)} is to the right of ${fmt(lesser)}, so ${fmt(greater)} is greater and ${fmt(lesser)} is less. The ${p.op === "min" || p.op === "<" ? "less" : "greater"} number = ${fmt(target)}.`,
    ];
  }

  const f = structureFacts(p);
  if (p.op === "+") {
    if (f.sameSigns) {
      const sign = p.a < 0 ? "negative" : "positive";
      return [
        `Both numbers are ${sign}, so add their sizes: |${p.a}| + |${p.b}| = ${f.absA} + ${f.absB} = ${f.absA + f.absB}.`,
        `Keep the common sign (${sign}): ${p.display} = ${fmt(p.expected)}.`,
      ];
    }
    return [
      `The signs are different, so subtract the smaller size from the larger: ${f.largerAbs} − ${f.smallerAbs} = ${f.largerAbs - f.smallerAbs}.`,
      `${fmt(f.larger)} has the larger size and is ${f.signOfLarger}, so the answer is ${f.signOfLarger}: ${p.display} = ${fmt(p.expected)}.`,
    ];
  }
  if (p.op === "-") {
    const asAdd = makeProblem(p.a, "+", -p.b);
    return [
      `Subtracting ${wrapNum(p.b)} is the same as adding its opposite, ${wrapNum(-p.b)}: ${p.display} = ${asAdd.display}.`,
      ...workedSteps(asAdd),
    ];
  }
  const same = f.sameSigns;
  const verb = p.op === "*" ? "Multiply" : "Divide";
  return [
    `${verb} the sizes: ${f.absA} ${p.op === "*" ? "×" : "÷"} ${f.absB} = ${Math.abs(p.expected)}.`,
    `The signs are ${same ? "the same, so the answer is positive" : "different, so the answer is negative"}: ${p.display} = ${fmt(p.expected)}.`,
  ];
}

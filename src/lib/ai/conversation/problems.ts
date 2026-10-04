/**
 * Phase 23: Deterministic problem and worked-example generation.
 * Every number the tutor poses or solves comes from here, never from an LLM, so correctness is guaranteed.
 */

import { displayProblem, fmt, sameProblem } from "./arith";
import type { Operator, ParsedProblem } from "./types";

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

export function problemKey(p: ParsedProblem): string {
  return `${p.a}|${p.op}|${p.b}`;
}

function compute(a: number, op: Operator, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return a / b;
  }
}

export function makeProblem(a: number, op: Operator, b: number): ParsedProblem {
  return { a, b, op, display: displayProblem(a, op, b), expected: compute(a, op, b) };
}

/**
 * New problem with the same operation and sign pattern as `original` (so it exercises the same idea)
 * but different numbers. `avoid` lists problem keys that must not be reused.
 */
export function generateRelatedProblem(original: ParsedProblem, kind: ProblemKind, seed: number, avoid: string[] = []): ParsedProblem {
  const rand = rng(seed ^ hashString(problemKey(original)) ^ hashString(kind));
  const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  const range: [number, number] = kind === "SIMPLER" ? [1, 9] : kind === "HARDER" ? [12, 45] : [2, 19];
  const sa = original.a < 0 ? -1 : 1;
  const sb = original.b < 0 ? -1 : 1;
  const forbidden = new Set([problemKey(original), ...avoid]);

  for (let attempt = 0; attempt < 200; attempt++) {
    let a: number;
    let b: number;
    if (original.op === "/") {
      const mb = kind === "HARDER" ? pick(6, 12) : pick(2, 9);
      const q = kind === "HARDER" ? pick(6, 12) : pick(2, 9);
      b = sb * mb;
      a = sa * mb * q;
    } else if (original.op === "*") {
      a = sa * (kind === "HARDER" ? pick(7, 15) : kind === "SIMPLER" ? pick(2, 6) : pick(2, 9));
      b = sb * (kind === "HARDER" ? pick(6, 12) : kind === "SIMPLER" ? pick(2, 6) : pick(2, 9));
    } else {
      a = sa * pick(range[0], range[1]);
      b = sb * pick(range[0], range[1]);
      // Mixed-sign addition/subtraction: avoid a zero result and make sure magnitudes differ
      if (Math.abs(a) === Math.abs(b)) continue;
    }
    const p = makeProblem(a, original.op, b);
    if (forbidden.has(problemKey(p))) continue;
    if (p.expected === original.expected) continue; // would let a memorised answer pass
    if (p.expected === 0) continue;
    return p;
  }
  // Extremely unlikely fallback: a fixed related problem that differs from the original.
  const fallback = makeProblem(original.a + (original.a < 0 ? -1 : 1), original.op, original.b);
  return sameProblem(fallback, original) ? makeProblem(7, "+", -3) : fallback;
}

export function opWord(op: Operator): string {
  return op === "+" ? "addition" : op === "-" ? "subtraction" : op === "*" ? "multiplication" : "division";
}

/** Facts that describe the problem's structure WITHOUT stating the result. */
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
  const f = structureFacts(p);
  const wrap = (n: number) => (n < 0 ? `(${n})` : String(n));
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
      `Subtracting ${wrap(p.b)} is the same as adding its opposite, ${wrap(-p.b)}: ${p.display} = ${asAdd.display}.`,
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

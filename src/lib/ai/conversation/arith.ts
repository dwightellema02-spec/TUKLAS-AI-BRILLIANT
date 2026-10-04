/**
 * Phase 23: Integer expression parsing and number-word handling for the conversational core.
 */

import { evaluateArithmetic } from "../../documents/question-generation";
import type { Operator, ParsedProblem } from "./types";

const UNICODE_MINUS = /[−–—]/g;

export function normalizeMath(text: string): string {
  return text
    .replace(UNICODE_MINUS, "-")
    .replace(/\\times|\\cdot|×|·/g, "*")
    .replace(/\\div|÷/g, "/")
    .replace(/\$/g, "")
    .replace(/\\left|\\right/g, "");
}

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** Parses "negative twelve", "minus 5", "twenty-one", "-7", "+3". Returns undefined if not a number. */
export function parseSpokenNumber(raw: string): number | undefined {
  const t = normalizeMath(raw).toLowerCase().trim().replace(/[?.!,]+$/g, "");
  if (/^[+-]?\d+(\.\d+)?$/.test(t)) return parseFloat(t);

  let sign = 1;
  let words = t.split(/[\s-]+/).filter(Boolean);
  if (words[0] === "negative" || words[0] === "minus") {
    sign = -1;
    words = words.slice(1);
  } else if (words[0] === "positive" || words[0] === "plus") {
    words = words.slice(1);
  }
  if (words.length === 0) return undefined;
  let total = 0;
  for (const w of words) {
    if (/^\d+$/.test(w)) total += parseInt(w, 10);
    else if (w in ONES) total += ONES[w];
    else if (w in TENS) total += TENS[w];
    else return undefined;
  }
  return sign * total;
}

/** Finds the first number-like thing in free text: digits (with sign) or a number word phrase. */
export function findNumberInText(text: string): number | undefined {
  const norm = normalizeMath(text).toLowerCase();
  // "negative 12", "minus five", "-12", "12"
  const re = /((?:negative|minus|positive|plus)\s+)?(\d+(?:\.\d+)?|(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?))|(?<![\w)])([+-]\d+(?:\.\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(norm)) !== null) {
    if (m[3]) return parseFloat(m[3]);
    const n = parseSpokenNumber(`${m[1] ?? ""}${m[2]}`);
    if (n !== undefined) return n;
  }
  return undefined;
}

export function fmt(n: number): string {
  return n < 0 ? `-${Math.abs(n)}` : String(n);
}

/** "(-8) + 13" style display. */
export function displayProblem(a: number, op: Operator, b: number): string {
  const wrap = (n: number) => (n < 0 ? `(${n})` : String(n));
  const sym = op === "*" ? "×" : op === "/" ? "÷" : op === "-" ? "−" : "+";
  return `${wrap(a)} ${sym} ${wrap(b)}`;
}

const NUM = "\\(?\\s*[+-]?\\s*\\d+(?:\\.\\d+)?\\s*\\)?";
const BINARY = new RegExp(`(${NUM})\\s*([+\\-*/])\\s*(${NUM})`);

function toNum(s: string): number {
  return parseFloat(s.replace(/[()\s]/g, ""));
}

/**
 * Finds a binary integer expression "a op b" in free text (e.g. "what is (-8) + 13?").
 * Returns undefined when the text has no unambiguous binary expression.
 */
export function parseBinaryProblem(text: string): ParsedProblem | undefined {
  const norm = normalizeMath(text);
  const m = BINARY.exec(norm);
  if (!m) return undefined;
  const a = toNum(m[1]);
  const b = toNum(m[3]);
  const op = m[2] as Operator;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  if (op === "/" && b === 0) return undefined;
  const expected = evaluateArithmetic(`${a < 0 ? `(${a})` : a}${op}${b < 0 ? `(${b})` : b}`);
  if (expected === null || !Number.isInteger(expected)) return undefined;
  return { a, b, op, display: displayProblem(a, op, b), expected };
}

export function sameProblem(x?: ParsedProblem, y?: ParsedProblem): boolean {
  return !!x && !!y && x.a === y.a && x.b === y.b && x.op === y.op;
}

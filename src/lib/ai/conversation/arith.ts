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
// Filipino number words (isa..sampu); common in Taglish answers such as "negative lima".
const FIL_ONES: Record<string, number> = { isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10, wala: 0 };
// Filipino 11-19 ("labing-apat", "labinlima", "labimpito") and round tens ("dalawampu", "tatlumpu"...).
const FIL_TEEN = /^lab(?:ing|in|im)(isa|dalawa|tatlo|apat|lima|anim|pito|walo|siyam)$/;
const FIL_TENS: Record<string, number> = { sampu: 10, dalawampu: 20, tatlumpu: 30, apatnapu: 40, limampu: 50, animnapu: 60, pitumpu: 70, walumpu: 80, siyamnapu: 90 };
export function parseFilipinoCompound(word: string): number | undefined {
  const w = word.toLowerCase().replace(/[\s-]+/g, "");
  const m = FIL_TEEN.exec(w);
  if (m) return 10 + (FIL_ONES[m[1]] ?? 0);
  return FIL_TENS[w];
}
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** Parses "negative twelve", "minus 5", "twenty-one", "-7", "+3". Returns undefined if not a number. */
export function parseSpokenNumber(raw: string): number | undefined {
  const t = normalizeMath(raw).toLowerCase().trim().replace(/[?.!,]+$/g, "");
  if (/^[+-]?\d+(\.\d+)?$/.test(t)) return parseFloat(t);

  let sign = 1;
  // Keep Filipino teens together: "labing-apat" must not be split at the hyphen.
  let words = t.replace(/\b(lab(?:ing|in|im))[\s-]+/g, "$1").split(/[\s-]+/).filter(Boolean);
  if (words[0] === "negative" || words[0] === "minus" || words[0] === "negatibo") {
    sign = -1;
    words = words.slice(1);
  } else if (words[0] === "positive" || words[0] === "plus" || words[0] === "positibo") {
    words = words.slice(1);
  }
  if (words.length === 0) return undefined;
  let total = 0;
  for (const w of words) {
    const fc = parseFilipinoCompound(w);
    if (/^\d+$/.test(w)) total += parseInt(w, 10);
    else if (fc !== undefined) total += fc;
    else if (w in ONES) total += ONES[w];
    else if (w in FIL_ONES) total += FIL_ONES[w];
    else if (w in TENS) total += TENS[w];
    else return undefined;
  }
  return sign * total;
}

/** Finds the first number-like thing in free text: digits (with sign) or a number word phrase. */
export function findNumberInText(text: string): number | undefined {
  const norm = normalizeMath(text).toLowerCase();
  // "negative 12", "minus five", "-12", "12"
  const re = /((?:negative|minus|negatibo|positive|plus|positibo)\s+)?(\d+(?:\.\d+)?|(?:lab(?:in|ing|im)-?(?:isa|dalawa|tatlo|apat|lima|anim|pito|walo|siyam)|dalawampu|tatlumpu|apatnapu|limampu|animnapu|pitumpu|walumpu|siyamnapu)|(?:isa|dalawa|tatlo|apat|lima|anim|pito|walo|siyam|sampu)|(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?:[\s-](?:one|two|three|four|five|six|seven|eight|nine))?))|(?<![\w)])([+-]\d+(?:\.\d+)?)/g;
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
  return { kind: "BINARY", a, b, op, display: displayProblem(a, op, b), expected };
}

export function sameProblem(x?: ParsedProblem, y?: ParsedProblem): boolean {
  return !!x && !!y && x.a === y.a && x.b === y.b && x.op === y.op;
}


// ---------------------------------------------------------------------------------------------
// Further problem kinds (Phase 24)
// ---------------------------------------------------------------------------------------------

const SIGNED = "\\(?\\s*[+-]?\\s*\\d+\\s*\\)?";
const toInt = (x: string) => parseInt(x.replace(/[()\s]/g, ""), 10);

export function wrapNum(n: number): string {
  return n < 0 ? `(${n})` : String(n);
}

/** "x + 5 = 12", "solve y - (-4) = 11" */
export function parseEquationProblem(text: string): ParsedProblem | undefined {
  const norm = normalizeMath(text);
  const m = new RegExp(`\\b([a-z])\\s*([+-])\\s*(${SIGNED})\\s*=\\s*(${SIGNED})`, "i").exec(norm);
  if (!m) return undefined;
  const a = toInt(m[3]);
  const b = toInt(m[4]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  const op = m[2] === "+" ? "x+" : "x-";
  const expected = op === "x+" ? b - a : b + a;
  return { kind: "EQUATION", a, b, op, variable: m[1].toLowerCase(), expected, display: `${m[1].toLowerCase()} ${m[2] === "+" ? "+" : "−"} ${wrapNum(a)} = ${b}` };
}

/** "|-14|", "absolute value of -14", "absolute value ng -14" */
export function parseAbsProblem(text: string): ParsedProblem | undefined {
  const norm = normalizeMath(text);
  const m = /\|\s*([+-]?\d+)\s*\|/.exec(norm) || /absolute value\s*(?:of|ng)?\s*\(?\s*([+-]?\d+)/i.exec(norm);
  if (!m) return undefined;
  const a = parseInt(m[1], 10);
  return { kind: "ABS", a, b: 0, op: "abs", expected: Math.abs(a), display: `|${a}|` };
}

/** "opposite of -8", "additive inverse of 5", "kabaligtaran ng -8" */
export function parseOppositeProblem(text: string): ParsedProblem | undefined {
  const norm = normalizeMath(text);
  const m = /(?:opposite|additive inverse|kabaligtaran)[^0-9+\-]*([+-]?\s*\d+)/i.exec(norm);
  if (!m) return undefined;
  const a = parseInt(m[1].replace(/\s/g, ""), 10);
  if (!Number.isFinite(a)) return undefined;
  return { kind: "OPPOSITE", a, b: 0, op: "opp", expected: a === 0 ? 0 : -a, display: `the opposite of ${wrapNum(a)}` };
}

/** "-5 > -2", "is -5 greater than -2", "which is greater: -5 or -2" */
export function parseCompareProblem(text: string): ParsedProblem | undefined {
  const norm = normalizeMath(text);
  const sym = new RegExp(`(${SIGNED})\\s*([<>])\\s*(${SIGNED})`).exec(norm);
  if (sym) {
    const a = toInt(sym[1]);
    const b = toInt(sym[3]);
    const op = sym[2] as ">" | "<";
    const truth = op === ">" ? a > b : a < b;
    return { kind: "COMPARE", a, b, op, expected: truth ? 1 : 0, display: `${wrapNum(a)} ${op} ${wrapNum(b)}` };
  }
  const words = new RegExp(`(${SIGNED})\\s*(?:is\\s+)?(greater|less|bigger|smaller|mas malaki|mas maliit)\\s*(?:than|kaysa)?\\s*(${SIGNED})`, "i").exec(norm);
  if (words) {
    const a = toInt(words[1]);
    const b = toInt(words[3]);
    const op = /greater|bigger|malaki/i.test(words[2]) ? ">" : "<";
    const truth = op === ">" ? a > b : a < b;
    return { kind: "COMPARE", a, b, op, expected: truth ? 1 : 0, display: `${wrapNum(a)} ${op} ${wrapNum(b)}` };
  }
  const which = new RegExp(`which\\s+(?:is|number is)\\s+(greater|less|larger|smaller)[^0-9+\\-]*(${SIGNED})\\s*(?:,|or|and)\\s*(${SIGNED})`, "i").exec(norm);
  if (which) {
    const a = toInt(which[2]);
    const b = toInt(which[3]);
    const wantMax = /greater|larger/i.test(which[1]);
    return { kind: "COMPARE", a, b, op: wantMax ? "max" : "min", expected: wantMax ? Math.max(a, b) : Math.min(a, b), display: `which is ${wantMax ? "greater" : "less"}: ${wrapNum(a)} or ${wrapNum(b)}` };
  }
  return undefined;
}

/**
 * Recognises any supported problem kind in free text. Order matters: equations and comparisons contain
 * numbers and operators that would otherwise be mistaken for plain arithmetic.
 */
export function parseAnyProblem(text: string): ParsedProblem | undefined {
  return parseEquationProblem(text) ?? parseCompareProblem(text) ?? parseAbsProblem(text) ?? parseOppositeProblem(text) ?? parseBinaryProblem(text);
}

/** true/false answers in English and Filipino. Only call when a truth value is expected. */
export function parseTruth(text: string): boolean | undefined {
  const t = text.toLowerCase().replace(/[.!?,]/g, " ").replace(/\b(ba|po|siguro|yata|ata|baka|maybe|i think)\b/g, " ").replace(/\s+/g, " ").trim();
  if (/^(true|yes|tama|totoo|oo|yep|yeah|correct)( po)?$/.test(t)) return true;
  if (/^(false|no|mali|hindi totoo|hindi|di|nope|incorrect)( po)?$/.test(t)) return false;
  if (/\b(it'?s|it is|ito ay|ang sagot ay)\s+(true|tama|totoo)\b/.test(t)) return true;
  if (/\b(it'?s|it is|ito ay|ang sagot ay)\s+(false|mali)\b/.test(t)) return false;
  return undefined;
}

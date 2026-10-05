/**
 * Spoken-math normalisation (Phase 32).
 *
 * Speech recognition and students both write maths as words: "negative five plus three",
 * "absolute value of negative fourteen", "x plus five equals twelve", "negative lima plus tatlo".
 * The tutor's evaluator understands digits and symbols, so this turns the words into them:
 * "-5 + 3", "absolute value of -14", "x + 5 = 12". Pure and deterministic; no network, no model.
 *
 * It only rewrites number words, a small set of operator words and speech-engine homophones that sit
 * inside a maths context. Everything else is left exactly as spoken. The caller keeps the original
 * transcript; this is used for understanding, not for display.
 */

const EN_ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const EN_TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const FIL_ONES: Record<string, number> = { wala: 0, isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5, anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10 };
const FIL_TENS: Record<string, number> = {
  dalawampu: 20, dalawampung: 20, tatlumpu: 30, tatlumpung: 30, apatnapu: 40, apatnapung: 40, limampu: 50, limampung: 50,
  animnapu: 60, animnapung: 60, pitumpu: 70, pitumpung: 70, walumpu: 80, walumpung: 80, siyamnapu: 90, siyamnapung: 90,
};
const FIL_TEEN = /^lab(?:ing|in|im)(isa|dalawa|tatlo|apat|lima|anim|pito|walo|siyam)$/;

/** Words that, next to a homophone, show the speaker meant a number. */
const OPERATOR_WORDS = new Set(["plus", "minus", "times", "by", "negative", "positive", "equals", "negatibo", "positibo", "over"]);

const HOMOPHONES: Record<string, number> = { to: 2, too: 2, for: 4, fore: 4, ate: 8, won: 1, tree: 3, free: 3 };
/** Words after which "minus"/"plus" is a sign, not a binary operator ("what is minus five"). */
const COPULA = new Set(["is", "are", "of", "than", "to", "be", "was", "what", "whats", "it", "its", "equals", "answer", "then", "so", "by"]);
const VARIABLE_HOMOPHONES: Record<string, string> = { ex: "x", why: "y" };

export interface NormalizedSpeech {
  /** Text with maths words replaced by digits and symbols. */
  text: string;
  /** The transcript exactly as received. */
  original: string;
  /** True when anything was rewritten. */
  changed: boolean;
  /** Human-readable list of the rewrites (for debugging and for the "I heard" hint). */
  notes: string[];
  /** True when a guess was involved (a homophone such as "to" -> 2 was repaired), so the student should check it. */
  uncertain: boolean;
}

type Tok = { kind: "word"; w: string } | { kind: "num"; v: number; single?: boolean } | { kind: "op"; op: "+" | "-" | "*" | "/" | "=" | "sign-" | "sign+" };

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    // "dalawampu't lima" -> "dalawampu at lima"
    .replace(/(\w)['’]t\b/g, "$1 at")
    // keep a Filipino teen together ("labing-apat" -> "labingapat"), split other hyphenated words ("twenty-three")
    .replace(/\b(lab(?:ing|in|im))[\s-]+/g, "$1")
    .replace(/(?<=[a-z])-(?=[a-z])/g, " ")
    .replace(/[,;:!?]+/g, " ")
    // a full stop ends a sentence ("is five."), a decimal point does not ("3.5")
    .replace(/\.(?=\s|$)/g, " ")
    .replace(/\b(uh|um|er|erm|ah|hmm|okay so)\b/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Reads a whole number phrase starting at tokens[i]. Returns undefined when tokens[i] does not start one. */
function readNumber(tokens: string[], i: number): { value: number; next: number; single: boolean } | undefined {
  // Digits (possibly glued to a sign or a decimal point)
  if (/^\d+$/.test(tokens[i])) return { value: parseInt(tokens[i], 10), next: i + 1, single: false };

  const t0 = tokens[i];
  const fil = FIL_TEEN.exec(t0);
  if (fil) return { value: 10 + FIL_ONES[fil[1]], next: i + 1, single: false };

  let total = 0;
  let current = 0;
  let last: "none" | "tens" | "unit" | "hundred" | "thousand" = "none";
  let j = i;
  let sawHundred = false;
  let consumedAny = false;
  for (; j < tokens.length; j++) {
    const w = tokens[j];
    const filTeen = FIL_TEEN.exec(w);
    if (w in EN_ONES && w !== "zero" && EN_ONES[w] >= 10 && (last === "none" || last === "hundred" || last === "thousand")) {
      current += EN_ONES[w]; last = "unit"; consumedAny = true;
    } else if (w in EN_ONES && EN_ONES[w] < 10 && (last === "none" || last === "tens" || last === "hundred" || last === "thousand")) {
      if (w === "zero" && last !== "none") break;
      current += EN_ONES[w]; last = "unit"; consumedAny = true;
    } else if (w in EN_TENS && (last === "none" || last === "hundred" || last === "thousand")) {
      current += EN_TENS[w]; last = "tens"; consumedAny = true;
    } else if (w in FIL_ONES && (last === "none" || last === "tens" || last === "hundred")) {
      if (w === "wala" && last !== "none") break;
      current += FIL_ONES[w]; last = "unit"; consumedAny = true;
    } else if (w in FIL_TENS && (last === "none" || last === "hundred")) {
      current += FIL_TENS[w]; last = "tens"; consumedAny = true;
    } else if (filTeen && (last === "none" || last === "hundred")) {
      current += 10 + FIL_ONES[filTeen[1]]; last = "unit"; consumedAny = true;
    } else if (w === "hundred" && consumedAny && last !== "hundred" && last !== "thousand") {
      current = (current || 1) * 100; last = "hundred"; sawHundred = true;
    } else if (w === "thousand" && consumedAny && last !== "thousand") {
      total += (current || 1) * 1000; current = 0; last = "thousand";
    } else if ((w === "daan" || w === "sandaan") && (consumedAny || w === "sandaan")) {
      current = w === "sandaan" ? 100 : (current || 1) * 100; last = "hundred"; sawHundred = true; consumedAny = true;
    } else if (w === "isang" && tokens[j + 1] === "daan") {
      current = 100; last = "hundred"; sawHundred = true; consumedAny = true; j += 1;
    } else if (w === "a" && j === i && (tokens[j + 1] === "hundred" || tokens[j + 1] === "thousand")) {
      current = 1; last = "none"; // "a hundred": the article becomes the 1 that "hundred" multiplies
      consumedAny = true;
    } else if ((w === "and" || w === "at") && consumedAny && last !== "none" && last !== "tens" && (sawHundred || last === "thousand" || w === "at") && readNumber(tokens, j + 1)) {
      continue; // "one hundred and five", "dalawampu at lima"
    } else if (w === "at" && last === "tens" && FIL_ONES[tokens[j + 1]] !== undefined && tokens[j + 1] !== "sampu" && tokens[j + 1] !== "wala") {
      continue; // "dalawampu at lima"
    } else {
      break;
    }
  }
  if (!consumedAny || j === i) return undefined;
  const single = j - i === 1 && (t0 === "one" || t0 === "isa");
  return { value: total + current, next: j, single };
}

function isDigitTok(t?: string) { return t !== undefined && /^[+-]?\d+(\.\d+)?$/.test(t); }
function isNumberStart(tokens: string[], i: number) { return tokens[i] !== undefined && !!readNumber(tokens, i); }
function isMathContextToken(tokens: string[], i: number): boolean {
  const t = tokens[i];
  if (t === undefined) return false;
  if (OPERATOR_WORDS.has(t) || isDigitTok(t)) return true;
  if (t === "divided" || t === "multiplied" || t === "added") return true;
  if (t in EN_ONES && t !== "one" && t !== "two") return true;
  if (t in EN_TENS) return true;
  return false;
}

/** Repairs speech-recognition homophones ("five plus to" -> "five plus two") only inside a maths context. */
function repairHomophones(tokens: string[], notes: string[]): { tokens: string[]; uncertain: boolean } {
  const out = [...tokens];
  let uncertain = false;
  for (let i = 0; i < out.length; i++) {
    const t = out[i];
    const prev = out[i - 1];
    const next = out[i + 1];
    if (t in VARIABLE_HOMOPHONES) {
      const adjacentOp = (prev !== undefined && OPERATOR_WORDS.has(prev)) || (next !== undefined && OPERATOR_WORDS.has(next));
      if (adjacentOp && prev !== "by") { out[i] = VARIABLE_HOMOPHONES[t]; notes.push(`${t}->${VARIABLE_HOMOPHONES[t]}`); uncertain = true; }
      continue;
    }
    if (!(t in HOMOPHONES)) continue;
    // "equal to five", "up to", "greater than or equal to": a preposition, not a number
    if (t === "to" && (prev === "equal" || prev === "equals" || prev === "up" || prev === "due" || prev === "according" || next === "the" || next === "be" || next === "a")) continue;
    if (t === "for" && (prev === "thanks" || prev === "waiting" || prev === "looking" || prev === "ask" || prev === "asking" || prev === "what" || prev === "is" || next === "the" || next === "a" || next === "me" || next === "this" || next === "example" || next === "you")) continue;
    const afterOperator = prev !== undefined && OPERATOR_WORDS.has(prev) && prev !== "equals";
    const afterEquals = prev === "equals" || (prev === "to" && out[i - 2] === "equal");
    const startsExpression = i === 0 && next !== undefined && OPERATOR_WORDS.has(next) && next !== "negative" && next !== "positive";
    const endsExpression = i === out.length - 1 && prev !== undefined && OPERATOR_WORDS.has(prev);
    if (afterOperator || startsExpression || endsExpression || afterEquals) {
      out[i] = String(HOMOPHONES[t]);
      notes.push(`${t}->${HOMOPHONES[t]}`);
      uncertain = true;
    }
  }
  return { tokens: out, uncertain };
}

export function normalizeSpokenMath(transcript: string, opts: { convertLoneNumbers?: boolean } = {}): NormalizedSpeech {
  const original = typeof transcript === "string" ? transcript : "";
  const notes: string[] = [];
  const base = tokenize(original);
  const repaired = repairHomophones(base, notes);
  const tokens = repaired.tokens;

  // Pass 1: classify tokens
  const toks: Tok[] = [];
  for (let i = 0; i < tokens.length; ) {
    const w = tokens[i];
    // multi-word operators
    if (w === "divided" && tokens[i + 1] === "by") { toks.push({ kind: "op", op: "/" }); i += 2; continue; }
    if (w === "multiplied" && tokens[i + 1] === "by") { toks.push({ kind: "op", op: "*" }); i += 2; continue; }
    if (w === "added" && tokens[i + 1] === "to") { toks.push({ kind: "op", op: "+" }); i += 2; continue; }
    if ((w === "is" || w === "are") && tokens[i + 1] === "equal" && tokens[i + 2] === "to") { toks.push({ kind: "op", op: "=" }); i += 3; continue; }
    if (w === "equal" && tokens[i + 1] === "to" && (isNumberStart(tokens, i + 2) || isDigitTok(tokens[i + 2]) || /^[a-z]$/.test(tokens[i + 2] ?? "") )) { toks.push({ kind: "op", op: "=" }); i += 2; continue; }
    if (w === "equals" || w === "equal" && toks.length > 0 && toks[toks.length - 1].kind !== "op") {
      if (w === "equals") { toks.push({ kind: "op", op: "=" }); i += 1; continue; }
    }
    if (w === "plus") { toks.push({ kind: "op", op: "+" }); i += 1; continue; }
    if (w === "minus" || w === "negatibo" || w === "negative") { toks.push({ kind: "op", op: w === "minus" ? "-" : "sign-" }); i += 1; continue; }
    if (w === "positive" || w === "positibo") { toks.push({ kind: "op", op: "sign+" }); i += 1; continue; }
    if (w === "times") { toks.push({ kind: "op", op: "*" }); i += 1; continue; }
    if (isDigitTok(w)) { toks.push({ kind: "num", v: parseFloat(w) }); i += 1; continue; }
    const num = readNumber(tokens, i);
    if (num) { toks.push({ kind: "num", v: num.value, single: num.single }); i = num.next; continue; }
    toks.push({ kind: "word", w });
    i += 1;
  }

  // Pass 2: resolve signs vs. binary operators, and keep ambiguous words as words
  const out: string[] = [];
  let changed = false;
  const mathNeighbour = (idx: number): boolean => {
    const t = toks[idx];
    return !!t && (t.kind === "op" || (t.kind === "num" && !t.single));
  };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind === "word") { out.push(t.w); continue; }
    if (t.kind === "num") {
      // a lone "one"/"isa" is far more often a pronoun than the number 1 ("this one"): only convert it in a maths context
      if (t.single && !opts.convertLoneNumbers && !mathNeighbour(i - 1) && !mathNeighbour(i + 1) && toks.length > 1) { out.push(t.v === 1 ? tokens[findWord(tokens, "one", "isa")] ?? "one" : String(t.v)); continue; }
      out.push(String(t.v)); changed = true; continue;
    }
    const prev = toks[i - 1];
    const next = toks[i + 1];
    // An operand is a number or a single-letter variable ("x plus five"); anything before it that is a plain word is not.
    const prevIsOperand = !!prev && (prev.kind === "num" || (prev.kind === "word" && /^[a-z]$/.test(prev.w)));
    const prevIsCopula = !prev || prev.kind === "op" || (prev.kind === "word" && COPULA.has(prev.w));
    const asSign =
      t.op === "sign-" || t.op === "sign+" ||
      (!prevIsOperand && prevIsCopula && (t.op === "-" || t.op === "+"));
    if (asSign) {
      const neg = t.op === "sign-" || t.op === "-";
      if (next && next.kind === "num") {
        const afterOperator = out.length > 0 && /^(\+|-|\*|\/|=)$/.test(out[out.length - 1]);
        const val = neg ? -next.v : next.v;
        out.push(neg && afterOperator ? `(${val})` : String(val));
        i += 1; changed = true; continue;
      }
      // "negative numbers", "plus" with nothing after it: keep the word
      out.push(t.op === "sign-" ? "negative" : t.op === "sign+" ? "positive" : t.op === "-" ? "minus" : "plus");
      continue;
    }
    // "times"/"divided by" between plain words ("a negative times a negative") is ordinary talk, not an operator
    if ((t.op === "*" || t.op === "/") && !(prevIsOperand && next && (next.kind === "num" || (next.kind === "op" && (next.op === "sign-" || next.op === "-")) || (next.kind === "word" && /^[a-z]$/.test(next.w))))) {
      out.push(t.op === "*" ? "times" : "divided by");
      continue;
    }
    out.push(t.op); changed = true;
  }

  // "x" written by the recogniser as a word between numbers is left alone (ambiguous with multiplication).
  const text = out.join(" ").replace(/\s+/g, " ").trim();
  const wasChanged = changed || notes.length > 0 || text !== original.trim().toLowerCase().replace(/\s+/g, " ");
  return { text: changed || notes.length > 0 ? text : original.trim(), original, changed: changed || notes.length > 0, notes, uncertain: repaired.uncertain && wasChanged };
}

function findWord(tokens: string[], ...candidates: string[]): number {
  return tokens.findIndex((t) => candidates.includes(t));
}

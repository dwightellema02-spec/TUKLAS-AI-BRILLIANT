/**
 * Phase 23: Verifying tutor output against the plan and conversation state.
 * These checks apply to LLM output AND to the local realizer, so neither can silently break the pedagogy.
 */

import { kindOf, problemNumbers } from "./problems";
import { normalizeSpokenMath } from "../../voice/spoken-math";
import type { ConversationState, ResponsePlan } from "./types";

export type Violation =
  | "ANSWER_DISCLOSED"
  | "REPEATED_MESSAGE"
  | "REPEATED_QUESTION"
  | "QUESTION_COUNT"
  | "TOO_LONG"
  | "MISSING_POSED_PROBLEM"
  | "WRONG_CORRECTNESS_CLAIM"
  | "PROMPT_LEAK"
  | "ANSWER_VALUE_MENTIONED"
  | "EMPTY";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();

export function similarity(a: string, b: string): number {
  const ta = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(norm(b).split(" ").filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function tokenPattern(value: string): string {
  // Matches the number as a standalone token ("-5" must not match inside "-15", "5" must not match "15" or "5.5").
  return `(?<![\\d.])${escapeRe(value.replace("-", "-"))}(?![\\d])`;
}

/** True if `text` asserts `value` as the result of the problem (not merely mentions the number). */
export function disclosesAnswer(text: string, plan: ResponsePlan): boolean {
  const answer = plan.protectedAnswer;
  if (answer === undefined) return false;
  const t = text.replace(/−/g, "-").replace(/\$/g, "");

  // True/false statement problems: protect the truth value ("the statement is false", "ito ay mali").
  const stmt = plan.activeProblem;
  if (stmt && (stmt.op === ">" || stmt.op === "<")) {
    const truthWord = answer === "true" ? "(?:true|tama|totoo)" : "(?:false|mali)";
    return new RegExp(`(?:answer is|statement is|that is|that'?s|it'?s|it is|ito ay|ang sagot ay|so it'?s|is actually)\\s+(?:also\\s+)?${truthWord}\\b`, "i").test(t);
  }

  const aliasRe = plan.protectedAnswerAliases.map((a) => (/^-?\d/.test(a) ? tokenPattern(a) : escapeRe(a))).join("|");
  if (!aliasRe) return false;

  // "the answer is 5", "result: -3", "equals 12", "= 5", "you get 5", "comes out to 5", "it's 5", "so it is -3"
  const assertion = new RegExp(
    `(?:answer|result|solution|equals?|gives?|get|gets|got|comes? (?:out )?to|works? out to|total|sum|difference|product|quotient|=|it'?s|it is|is)\\s*(?:is|are|:|to|be)?\\s*(?:just\\s+)?(?:${aliasRe})`,
    "gi"
  );
  const p = plan.activeProblem;
  const WEAK = /^(?:is|it'?s|it is)\b/i;
  // A bare "is N ..." that merely describes an operand of the problem ("where is 24 on the number line",
  // "is 24 a positive number") restates the problem; it does not assert a result. This only applies when the
  // number written is exactly an operand (sign included): "-24 is 24 from zero" still counts as disclosure.
  const DESCRIBES_OPERAND = /^\s*(?:on|from|a|an|to|above|below|positive|negative|left|right)\b/i;
  const operandValues = p ? problemNumbers(p) : [];

  for (const match of t.matchAll(assertion)) {
    const weak = WEAK.test(match[0].trim()) && !/(?:answer|result|equals?|=)/i.test(match[0]);
    if (!weak) return true;

    // Weak "is N": restating an operand of a two-number problem is not a disclosure...
    if (p && kindOf(p) === "BINARY") {
      const operandAbs = new Set([Math.abs(p.a), Math.abs(p.b)].map(String));
      const bare = match[0].replace(/^(?:is|it'?s|it is)\s*/i, "").trim().replace(/^-/, "");
      if (operandAbs.has(bare)) continue;
    }
    // ...and neither is describing the position or sign of an operand.
    const written = /-?\d+(?:\.\d+)?\s*$/.exec(match[0]);
    const writtenValue = written ? parseFloat(written[0]) : NaN;
    const after = t.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 30);
    if (operandValues.includes(writtenValue) && DESCRIBES_OPERAND.test(after)) continue;
    return true;
  }
  return false;
}

export interface GuardInput {
  message: string;
  guidingQuestion?: string;
}

export function checkTutorOutput(out: GuardInput, plan: ResponsePlan, state: ConversationState): Violation[] {
  const v: Violation[] = [];
  const full = `${out.message} ${out.guidingQuestion ?? ""}`.trim();
  if (!full) return ["EMPTY"];

  if (disclosesAnswer(full, plan)) v.push("ANSWER_DISCLOSED");

  // Repetition: against the last few tutor messages (skip for strategies that legitimately restate).
  const recent = state.recentTutorMessages.slice(-3);
  if (recent.some((m) => similarity(m, full) >= 0.85)) v.push("REPEATED_MESSAGE");
  if (out.guidingQuestion && state.lastTutorQuestion && norm(out.guidingQuestion) === norm(state.lastTutorQuestion) && plan.strategy !== "NUDGE_TO_RESPOND") {
    v.push("REPEATED_QUESTION");
  }

  if (plan.mustAskOneQuestion) {
    const q = (full.match(/\?/g) || []).length;
    if (q === 0 || q > 2) v.push("QUESTION_COUNT");
  }
  if (out.message.length > 900) v.push("TOO_LONG");

  if (plan.problemToPose && (plan.strategy === "TRANSFER_PROBLEM" || plan.strategy === "SIMPLER_PROBLEM" || plan.strategy === "HARDER_PROBLEM")) {
    const has = (n: string) => new RegExp(`(?<![\\d.])${n}(?![\\d])`).test(full.replace(/−/g, "-"));
    if (!problemNumbers(plan.problemToPose).every((n) => has(String(Math.abs(n))))) v.push("MISSING_POSED_PROBLEM");
  }

  if (plan.evaluation.kind === "INCORRECT" && /\b(?:that'?s|that is|is|you'?re|you are)\s+(?:absolutely\s+|exactly\s+)?(?:correct|right)\b|\bwell done\b|\bexactly right\b|\btama\b[!,.]|\btama (?:ang|ka|na|iyan|iyon)\b/i.test(full)) {
    v.push("WRONG_CORRECTNESS_CLAIM");
  }
  if (plan.evaluation.kind === "CORRECT" && /\b(?:incorrect|not quite|not right|wrong|isn'?t (?:right|correct)|not it yet)\b|\bmali\b|\bhindi (?:pa )?(?:tama|iyon)\b/i.test(full) && plan.strategy !== "SIMPLER_PROBLEM") {
    v.push("WRONG_CORRECTNESS_CLAIM");
  }
  return v;
}


/**
 * Stricter screen for text that came from a language model (not for the local realizer, which is built from the plan):
 * the protected answer must not appear AT ALL as a stand-alone value, however it is written (digits, full-width or
 * mathematical digits, English or Filipino number words, with a sign or "negative"/"minus"). A model that was talked into
 * the answer does not always use a phrase like "the answer is". Numbers that are part of the problem itself are allowed.
 * False positives (a worked example whose own result equals the answer) cost one retry, then the plan realizer answers.
 */
export function mentionsAnswerValue(text: string, plan: ResponsePlan): boolean {
  const answer = plan.protectedAnswer;
  if (answer === undefined || answer === "true" || answer === "false") return false;
  const value = Number(answer);
  if (!Number.isFinite(value)) return false;
  const asDigits = normalizeSpokenMath(text.normalize("NFKC").replace(/−/g, "-").replace(/\$/g, " ").replace(/(^|[\s(=:])-\s+(?=\d)/g, "$1-"), { convertLoneNumbers: true }).text.replace(/[,](?=\d{3}\b)/g, "");
  const operands = new Set((plan.activeProblem ? problemNumbers(plan.activeProblem) : []).map((n) => String(n)));
  const re = /(?<![\d.])(-?\d+(?:\.\d+)?)(?![\d])/g;
  for (const m of asDigits.matchAll(re)) {
    const n = Number(m[1]);
    if (n !== value) continue;
    if (operands.has(String(n)) || operands.has(String(Math.abs(n)))) continue; // part of the problem as given
    // "-5" written with a space ("- 5") or as a trailing sign is still the same value: matched above by normalisation
    return true;
  }
  return false;
}

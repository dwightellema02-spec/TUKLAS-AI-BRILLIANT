/**
 * Phase 23: Verifying tutor output against the plan and conversation state.
 * These checks apply to LLM output AND to the local realizer, so neither can silently break the pedagogy.
 */

import type { ConversationState, ResponsePlan } from "./types";

export type Violation =
  | "ANSWER_DISCLOSED"
  | "REPEATED_MESSAGE"
  | "REPEATED_QUESTION"
  | "QUESTION_COUNT"
  | "TOO_LONG"
  | "MISSING_POSED_PROBLEM"
  | "WRONG_CORRECTNESS_CLAIM"
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
  const aliasRe = plan.protectedAnswerAliases.map((a) => (/^-?\d/.test(a) ? tokenPattern(a) : escapeRe(a))).join("|");
  if (!aliasRe) return false;

  // "the answer is 5", "result: -3", "equals 12", "= 5", "you get 5", "comes out to 5", "it's 5", "so it is -3"
  const assertion = new RegExp(
    `(?:answer|result|solution|equals?|gives?|get|gets|got|comes? (?:out )?to|works? out to|total|sum|difference|product|quotient|=|it'?s|it is|is)\\s*(?:is|are|:|to|be)?\\s*(?:just\\s+)?(?:${aliasRe})`,
    "i"
  );
  const match = assertion.exec(t);
  if (!match) return false;

  // "is 5" is only a disclosure if it is not simply restating a number from the problem itself
  const p = plan.activeProblem;
  if (p && /^(?:is|it'?s|it is)\b/i.test(match[0].trim())) {
    const operandAbs = new Set([Math.abs(p.a), Math.abs(p.b)].map(String));
    const bare = match[0].replace(/^(?:is|it'?s|it is)\s*/i, "").trim().replace(/^-/, "");
    if (operandAbs.has(bare) && !/(?:answer|result|equals?|=)/i.test(match[0])) return false;
  }
  return true;
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
    const a = String(Math.abs(plan.problemToPose.a));
    const b = String(Math.abs(plan.problemToPose.b));
    const has = (n: string) => new RegExp(`(?<![\\d.])${n}(?![\\d])`).test(full.replace(/−/g, "-"));
    if (!has(a) || !has(b)) v.push("MISSING_POSED_PROBLEM");
  }

  if (plan.evaluation.kind === "INCORRECT" && /\b(?:that'?s|that is|is|you'?re|you are)\s+(?:absolutely\s+|exactly\s+)?(?:correct|right)\b|\bwell done\b|\bexactly right\b/i.test(full)) {
    v.push("WRONG_CORRECTNESS_CLAIM");
  }
  if (plan.evaluation.kind === "CORRECT" && /\b(?:incorrect|not quite|not right|wrong|isn'?t (?:right|correct)|not it yet)\b/i.test(full) && plan.strategy !== "SIMPLER_PROBLEM") {
    v.push("WRONG_CORRECTNESS_CLAIM");
  }
  return v;
}

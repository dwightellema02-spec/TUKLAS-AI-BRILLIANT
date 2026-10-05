/**
 * Phase 23: Deterministic evaluation of what the student just answered, with a misconception diagnosis.
 * The tutor never trusts an LLM to decide whether an answer is right: correctness comes from here.
 */

import { fmt, findNumberInText } from "./arith";
import { kindOf } from "./problems";
import type { AnswerEvaluation, MistakeDiagnosis, Operator, ParsedProblem, StudentSignal } from "./types";

export interface EvaluableQuestion {
  type?: string;
  choices?: Array<{ id: string; text: string }>;
  /** Raw expected value from the question record (a choice id for multiple choice). */
  expectedAnswer?: string;
}

/** Resolve the display text of the expected answer (maps a multiple-choice id to its text). */
export function resolveExpectedAnswerText(q?: EvaluableQuestion): string | undefined {
  if (!q || q.expectedAnswer === undefined || q.expectedAnswer === null || q.expectedAnswer === "") return undefined;
  const byId = q.choices?.find((c) => c.id === q.expectedAnswer);
  return byId ? byId.text : String(q.expectedAnswer);
}

function applyOp(a: number, op: Operator, b: number): number | undefined {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b === 0 ? undefined : a / b;
  }
}

function diagnose(problem: ParsedProblem, attempt: number): MistakeDiagnosis {
  const { a, b, op, expected } = problem;
  const kind = kindOf(problem);

  if (kind === "ABS") {
    if (attempt === a && a < 0) return "ABS_KEPT_SIGN"; // |-14| answered -14
    if (attempt === -expected) return "ABS_KEPT_SIGN";
    return Math.abs(attempt - expected) <= 2 ? "CALCULATION_SLIP" : "UNKNOWN_INCORRECT";
  }
  if (kind === "OPPOSITE") {
    if (attempt === a) return "OPPOSITE_SAME_NUMBER";
    if (attempt === Math.abs(a) && a < 0 && expected !== attempt) return "SIGN_ERROR";
    return Math.abs(attempt - expected) <= 2 ? "CALCULATION_SLIP" : "UNKNOWN_INCORRECT";
  }
  if (kind === "EQUATION") {
    // Did the same operation instead of undoing it: x + a = b answered b + a; x - a = b answered b - a.
    const sameOp = op === "x+" ? b + a : b - a;
    if (attempt === sameOp && attempt !== expected) return "EQ_WRONG_INVERSE";
    if (expected !== 0 && attempt === -expected) return "SIGN_ERROR";
    return Math.abs(attempt - expected) <= 2 ? "CALCULATION_SLIP" : "UNKNOWN_INCORRECT";
  }
  if (kind === "COMPARE") {
    // Judging negatives by size: picking the number with the larger absolute value as "greater".
    const other = attempt === a ? b : a;
    if ((attempt === a || attempt === b) && a < 0 && b < 0 && Math.abs(attempt) > Math.abs(other) && (op === "max" || op === ">")) return "COMPARED_MAGNITUDE";
    return "UNKNOWN_INCORRECT";
  }

  if (expected !== 0 && attempt === -expected) return "SIGN_ERROR";

  const absA = Math.abs(a);
  const absB = Math.abs(b);
  if (op === "+" && Math.sign(a) !== Math.sign(b) && a !== 0 && b !== 0 && Math.abs(attempt) === absA + absB) {
    return "ADDED_MAGNITUDES";
  }
  const absResult = applyOp(absA, op, absB);
  if (absResult !== undefined && attempt === absResult && attempt !== expected) return "IGNORED_SIGNS";

  for (const other of ["+", "-", "*", "/"] as Operator[]) {
    if (other === op) continue;
    const r = applyOp(a, other, b);
    if (r !== undefined && Number.isInteger(r) && r === attempt) return "WRONG_OPERATION";
  }
  if (Math.abs(attempt - expected) <= 2) return "CALCULATION_SLIP";
  return "UNKNOWN_INCORRECT";
}

const OBSERVATIONS: Record<MistakeDiagnosis, string> = {
  SIGN_ERROR: "The size of the student's answer is right but its sign is not.",
  IGNORED_SIGNS: "The student seems to have worked with the numbers as if they were all positive.",
  ADDED_MAGNITUDES: "The student added the sizes (absolute values) even though the signs differ.",
  WRONG_OPERATION: "The student's number matches a different operation than the one asked.",
  CALCULATION_SLIP: "The student is close; this looks like a small arithmetic slip.",
  ABS_KEPT_SIGN: "The student kept the negative sign; an absolute value (a distance) is never negative.",
  OPPOSITE_SAME_NUMBER: "The student gave the number itself instead of its opposite.",
  EQ_WRONG_INVERSE: "The student repeated the operation instead of undoing it on both sides.",
  COMPARED_MAGNITUDE: "The student judged negative numbers by size instead of by position on the number line.",
  UNKNOWN_INCORRECT: "The answer is incorrect and does not match a common error pattern.",
};

export function evaluateAttempt(
  signal: StudentSignal,
  problem: ParsedProblem | undefined,
  question?: EvaluableQuestion
): AnswerEvaluation {
  if (signal.intent !== "ANSWER_ATTEMPT" || !signal.attempt) return { kind: "NONE" };
  const { number, choiceLetter, raw, truth } = signal.attempt;

  // True/false answers, against a parsed comparison statement or the question record
  if (truth !== undefined) {
    let expectedTruth: boolean | undefined;
    if (problem && (problem.op === ">" || problem.op === "<")) expectedTruth = problem.expected === 1;
    else if (question?.type === "TRUE_FALSE" && question.expectedAnswer !== undefined) {
      const e = String(question.expectedAnswer).trim().toLowerCase();
      expectedTruth = e === "true" ? true : e === "false" ? false : undefined;
    }
    if (expectedTruth === undefined) return { kind: "NONE", attempted: truth ? "true" : "false" };
    if (truth === expectedTruth) return { kind: "CORRECT", attempted: truth ? "true" : "false" };
    const bothNeg = problem && problem.a < 0 && problem.b < 0;
    return {
      kind: "INCORRECT",
      attempted: truth ? "true" : "false",
      diagnosis: bothNeg ? "COMPARED_MAGNITUDE" : "UNKNOWN_INCORRECT",
      safeObservation: bothNeg ? OBSERVATIONS.COMPARED_MAGNITUDE : "The true/false judgement is not correct.",
    };
  }

  // 1. Multiple choice by letter or by choice text
  if (question?.choices && question.choices.length > 0) {
    let chosenIdx = -1;
    if (choiceLetter) chosenIdx = choiceLetter.charCodeAt(0) - 97;
    else {
      const lowered = raw.toLowerCase().replace(/[−–]/g, "-");
      chosenIdx = question.choices.findIndex(
        (c) => c.text.trim().toLowerCase() === lowered.trim() || (number !== undefined && findNumberInText(c.text) === number && /^[+-]?\d+(\.\d+)?$/.test(c.text.trim().replace(/[−–]/g, "-")))
      );
    }
    const chosen = question.choices[chosenIdx];
    const expectedId = question.expectedAnswer;
    if (chosen && expectedId) {
      const correct = chosen.id === expectedId || chosen.text.trim() === resolveExpectedAnswerText(question)?.trim();
      return correct
        ? { kind: "CORRECT", attempted: chosen.text }
        : { kind: "INCORRECT", diagnosis: "UNKNOWN_INCORRECT", attempted: chosen.text, safeObservation: "The chosen option is not the correct one." };
    }
  }

  // 2. Numeric problem we can compute ourselves
  if (problem && number !== undefined) {
    if (number === problem.expected) return { kind: "CORRECT", attempted: fmt(number) };
    const diagnosis = diagnose(problem, number);
    return { kind: "INCORRECT", diagnosis, attempted: fmt(number), safeObservation: OBSERVATIONS[diagnosis] };
  }

  // 3. Numeric/text answer from the question record
  const expectedText = resolveExpectedAnswerText(question);
  if (expectedText !== undefined && number !== undefined) {
    const expectedNum = findNumberInText(expectedText);
    if (expectedNum !== undefined) {
      return number === expectedNum
        ? { kind: "CORRECT", attempted: fmt(number) }
        : { kind: "INCORRECT", diagnosis: expectedNum !== 0 && number === -expectedNum ? "SIGN_ERROR" : "UNKNOWN_INCORRECT", attempted: fmt(number), safeObservation: expectedNum !== 0 && number === -expectedNum ? OBSERVATIONS.SIGN_ERROR : "The answer is incorrect." };
    }
  }

  // Cannot evaluate: never claim correctness we cannot verify.
  return { kind: "NONE", attempted: number !== undefined ? fmt(number) : raw };
}

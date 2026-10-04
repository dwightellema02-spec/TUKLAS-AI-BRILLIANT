/**
 * Phase 23: Conversation state: persisted, versioned, and updated by pure functions.
 */

import { problemKey } from "./problems";
import type {
  AnswerEvaluation,
  ConversationPhase,
  ConversationState,
  ParsedProblem,
  ResponsePlan,
  StudentSignal,
  TutorStrategy,
} from "./types";

const MAX_HISTORY = 12;
const MAX_MESSAGES = 5;
const MAX_STATEMENTS = 6;
const MAX_USED_PROBLEMS = 24;

export function scaffoldForMastery(status?: string): number {
  switch (status) {
    case "MASTERED": return 0;
    case "PROFICIENT": return 1;
    case "DEVELOPING": return 2;
    case "LEARNING":
    case "NOT_STARTED":
    default: return 3;
  }
}

export function initialState(masteryStatus?: string): ConversationState {
  return {
    version: 1,
    turn: 0,
    phase: "OPENING",
    scaffold: scaffoldForMastery(masteryStatus),
    consecutiveConfusion: 0,
    consecutiveWrong: 0,
    consecutiveAnswerRequests: 0,
    correctStreak: 0,
    frustration: 0,
    wrongOnProblem: 0,
    strategyHistory: [],
    hintsGiven: [],
    recentTutorMessages: [],
    awaiting: "NONE",
    diagnoses: {},
    examplesGiven: 0,
    independentSuccesses: 0,
    needsTeacherAttention: false,
    recentStudentStatements: [],
    usedProblems: [],
    hintsOnProblem: 0,
  };
}

export function parseState(json: string | null | undefined, masteryStatus?: string): ConversationState {
  if (!json) return initialState(masteryStatus);
  try {
    const raw = JSON.parse(json);
    if (!raw || typeof raw !== "object" || raw.version !== 1) return initialState(masteryStatus);
    // Defaults first so a partially written/older state can never crash the tutor.
    return { ...initialState(masteryStatus), ...raw };
  } catch {
    return initialState(masteryStatus);
  }
}

export function serializeState(state: ConversationState): string {
  return JSON.stringify(state);
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Update state with what the student just did. `activeProblem` is the problem the message refers to
 * (the question, a student-typed problem, or a pending tutor-posed problem).
 */
export function observeStudentTurn(
  prev: ConversationState,
  signal: StudentSignal,
  evaluation: AnswerEvaluation,
  active: { problem?: ParsedProblem; source?: "QUESTION" | "STUDENT" | "TUTOR" }
): ConversationState {
  const s: ConversationState = JSON.parse(JSON.stringify(prev));
  s.turn += 1;
  s.lastStudentIntent = signal.intent;

  // Problem change resets per-problem counters (but not the whole conversation memory).
  const newKey = active.problem ? problemKey(active.problem) : s.problemKey;
  if (active.problem && newKey !== s.problemKey) {
    s.problemKey = newKey;
    s.wrongOnProblem = 0;
    s.hintsOnProblem = 0;
    s.consecutiveWrong = 0;
    s.lastDiagnosis = undefined;
    s.previousDiagnosis = undefined;
    if (!s.usedProblems.includes(newKey!)) s.usedProblems = [...s.usedProblems, newKey!].slice(-MAX_USED_PROBLEMS);
  }
  if (active.problem) {
    s.activeProblem = active.problem;
    s.activeProblemSource = active.source;
    if (active.source !== "TUTOR") s.baseProblem = active.problem;
  }

  if (signal.text) s.recentStudentStatements = [...s.recentStudentStatements, signal.text.slice(0, 200)].slice(-MAX_STATEMENTS);

  const confusionLike = signal.intent === "CONFUSED" || signal.intent === "DONT_KNOW" || (signal.confused && signal.intent !== "ANSWER_ATTEMPT");
  s.consecutiveConfusion = confusionLike ? s.consecutiveConfusion + 1 : signal.intent === "ANSWER_ATTEMPT" || signal.intent === "REASONING" ? 0 : s.consecutiveConfusion;
  s.consecutiveAnswerRequests = signal.intent === "REQUEST_ANSWER" ? s.consecutiveAnswerRequests + 1 : 0;

  if (signal.frustrated) s.frustration = clamp(s.frustration + 1, 0, 3);
  else if (signal.intent === "ANSWER_ATTEMPT" && evaluation.kind === "CORRECT") s.frustration = clamp(s.frustration - 1, 0, 3);

  if (signal.intent === "ANSWER_ATTEMPT" && evaluation.kind === "INCORRECT") {
    s.consecutiveWrong += 1;
    s.wrongOnProblem += 1;
    s.correctStreak = 0;
    s.scaffold = clamp(s.scaffold + 1, 0, 5);
    if (evaluation.diagnosis) {
      s.previousDiagnosis = prev.lastDiagnosis;
      s.lastDiagnosis = evaluation.diagnosis;
      s.diagnoses = { ...s.diagnoses, [evaluation.diagnosis]: (s.diagnoses[evaluation.diagnosis] ?? 0) + 1 };
    }
    if (s.pendingTransfer) s.pendingTransfer = { ...s.pendingTransfer, attempts: s.pendingTransfer.attempts + 1 };
  } else if (signal.intent === "ANSWER_ATTEMPT" && evaluation.kind === "CORRECT") {
    if (active.source === "TUTOR") s.independentSuccesses += 1;
    // Solving a student-typed problem returns focus to the lesson question (if any).
    if (active.source === "STUDENT") {
      s.activeProblemSource = undefined;
      s.activeProblem = undefined;
    }
    s.consecutiveWrong = 0;
    s.correctStreak += 1;
    s.scaffold = clamp(s.scaffold - 1, 0, 5);
  } else if (confusionLike) {
    s.scaffold = clamp(s.scaffold + 1, 0, 5);
  } else if (signal.intent === "REQUEST_EASIER") {
    s.scaffold = clamp(s.scaffold + 1, 0, 5);
  }
  return s;
}

/** Update state with what the tutor just said. */
export function recordTutorTurn(
  prev: ConversationState,
  plan: ResponsePlan,
  message: string,
  guidingQuestion?: string
): ConversationState {
  const s: ConversationState = JSON.parse(JSON.stringify(prev));
  s.strategyHistory = [...s.strategyHistory, { turn: s.turn, strategy: plan.strategy }].slice(-MAX_HISTORY);
  const isHelp: TutorStrategy[] = [
    "ACTIVATE_PRIOR", "VISUAL_NUMBER_LINE", "DECOMPOSE_STEPS", "WORKED_ANALOGOUS", "REAL_CONTEXT",
    "TARGET_MISCONCEPTION", "REVIEW_KEY_IDEAS", "SIMPLER_PROBLEM",
  ];
  if (isHelp.includes(plan.strategy)) {
    s.hintsGiven = [...s.hintsGiven, { turn: s.turn, strategy: plan.strategy, scaffold: plan.scaffold }].slice(-MAX_HISTORY);
    s.hintsOnProblem += 1;
  }
  if (plan.strategy === "WORKED_ANALOGOUS") s.examplesGiven += 1;
  s.recentTutorMessages = [...s.recentTutorMessages, message].slice(-MAX_MESSAGES);

  const q = guidingQuestion?.trim() || lastQuestionSentence(message);
  s.lastTutorQuestion = q || undefined;
  s.awaiting = plan.mustAskOneQuestion && q ? (plan.strategy === "TRANSFER_PROBLEM" || plan.strategy === "SIMPLER_PROBLEM" || plan.strategy === "HARDER_PROBLEM" ? "ANSWER" : "RESPONSE") : "NONE";

  s.phase = plan.phase;
  s.needsTeacherAttention = s.needsTeacherAttention || plan.needsTeacherAttention;

  // Posing a new problem makes it the pending problem; its answer is evaluated next turn.
  if (plan.problemToPose && (plan.strategy === "TRANSFER_PROBLEM" || plan.strategy === "SIMPLER_PROBLEM" || plan.strategy === "HARDER_PROBLEM")) {
    const kind = plan.strategy === "SIMPLER_PROBLEM" ? "SIMPLER" : plan.strategy === "HARDER_PROBLEM" ? "HARDER" : "TRANSFER";
    s.pendingTransfer = { problem: plan.problemToPose, attempts: 0, kind };
    const key = problemKey(plan.problemToPose);
    if (!s.usedProblems.includes(key)) s.usedProblems = [...s.usedProblems, key].slice(-MAX_USED_PROBLEMS);
  }
  // A correctly solved pending problem is finished (a newly posed one, set above, replaces it).
  const solvedPending =
    plan.intent === "ANSWER_ATTEMPT" &&
    plan.evaluation.kind === "CORRECT" &&
    prev.pendingTransfer &&
    plan.activeProblem &&
    problemKey(plan.activeProblem) === problemKey(prev.pendingTransfer.problem);
  const posedNew = plan.problemToPose && (plan.strategy === "TRANSFER_PROBLEM" || plan.strategy === "SIMPLER_PROBLEM" || plan.strategy === "HARDER_PROBLEM");
  if (solvedPending && !posedNew) s.pendingTransfer = undefined;
  if (plan.strategy === "CELEBRATE_AND_NEXT") s.pendingTransfer = undefined;
  return s;
}

export function lastQuestionSentence(text: string): string | undefined {
  const parts = text.replace(/\s+/g, " ").match(/[^.!?]*\?/g);
  return parts && parts.length > 0 ? parts[parts.length - 1].trim() : undefined;
}

export function recentStrategies(state: ConversationState, n: number): TutorStrategy[] {
  return state.strategyHistory.slice(-n).map((h) => h.strategy);
}

export function phaseAfter(state: ConversationState, strategy: TutorStrategy): ConversationPhase {
  switch (strategy) {
    case "OPEN_LESSON":
    case "OPEN_PROBLEM": return "OPENING";
    case "CONFIRM_AND_PROBE": return "CONFIRMING";
    case "TRANSFER_PROBLEM":
    case "HARDER_PROBLEM": return "TRANSFER";
    case "CELEBRATE_AND_NEXT": return "MASTERED_FOR_NOW";
    case "ASK_WHAT_THEY_THINK":
    case "ASK_FOR_REASONING": return state.wrongOnProblem > 0 ? "DIAGNOSING" : state.phase === "OPENING" ? "DIAGNOSING" : state.phase;
    default: return "SCAFFOLDING";
  }
}

/** Human-readable memory for the LLM prompt: what has already been said, tried and diagnosed. */
export function summarizeState(state: ConversationState): string {
  const lines: string[] = [];
  lines.push(`Turn ${state.turn}. Phase: ${state.phase}. Current help level: ${state.scaffold}/5 (0 = minimal, 5 = maximal).`);
  if (state.baseProblem) lines.push(`Original problem: ${state.baseProblem.display}.`);
  if (state.pendingTransfer) lines.push(`A new ${state.pendingTransfer.kind.toLowerCase()} problem is waiting for the student's answer: ${state.pendingTransfer.problem.display}.`);
  if (state.strategyHistory.length) lines.push(`Tutor moves so far: ${state.strategyHistory.map((h) => h.strategy).join(" -> ")}.`);
  if (state.hintsGiven.length) lines.push(`Hints/scaffolds already given: ${state.hintsGiven.map((h) => h.strategy).join(", ")}.`);
  if (state.lastTutorQuestion) lines.push(`Your last question to the student: "${state.lastTutorQuestion}".`);
  if (state.recentStudentStatements.length) lines.push(`The student's recent messages: ${state.recentStudentStatements.slice(-3).map((t) => `"${t}"`).join(" | ")}.`);
  const dx = Object.entries(state.diagnoses).filter(([, n]) => (n ?? 0) > 0);
  if (dx.length) lines.push(`Mistake patterns seen: ${dx.map(([k, n]) => `${k} x${n}`).join(", ")}.`);
  if (state.consecutiveConfusion > 0) lines.push(`The student has said they are confused/stuck ${state.consecutiveConfusion} time(s) in a row.`);
  if (state.wrongOnProblem > 0) lines.push(`Wrong attempts on the current problem: ${state.wrongOnProblem}.`);
  if (state.correctStreak > 0) lines.push(`Correct answers in a row: ${state.correctStreak}.`);
  if (state.frustration > 0) lines.push(`Frustration signals: ${state.frustration}/3.`);
  return lines.join("\n");
}

export function summarizeEvaluation(ev: AnswerEvaluation): string | undefined {
  if (ev.kind === "NONE") return undefined;
  if (ev.kind === "CORRECT") return `The student's latest answer${ev.attempted ? ` (${ev.attempted})` : ""} is CORRECT.`;
  return `The student's latest answer${ev.attempted ? ` (${ev.attempted})` : ""} is INCORRECT.${ev.safeObservation ? ` Diagnosis: ${ev.safeObservation}` : ""}`;
}

/**
 * Phase 23: Conversational core types.
 *
 * The tutor is modelled as: read the student (signals + answer evaluation) -> update conversation state
 * -> choose a pedagogical strategy (planner) -> realize it (LLM constrained by the plan, or the local
 * realizer) -> verify the output (guards) -> persist state.
 */

export type StudentIntent =
  | "ANSWER_ATTEMPT"
  | "STUDENT_PROBLEM" // the student typed their own problem, e.g. "what is -3 + 5?"
  | "REASONING" // the student explained their thinking
  | "REQUEST_ANSWER"
  | "REQUEST_HINT"
  | "REQUEST_EXPLANATION"
  | "REQUEST_EXAMPLE"
  | "REQUEST_EASIER"
  | "REQUEST_HARDER"
  | "REQUEST_REVIEW"
  | "DONT_KNOW"
  | "CONFUSED"
  | "FRUSTRATED"
  | "GREETING"
  | "ACKNOWLEDGE"
  | "OFF_TOPIC"
  | "OTHER";

export interface StudentSignal {
  intent: StudentIntent;
  /** Raw text, trimmed. Empty when the student pressed a hint button. */
  text: string;
  /** "TL" when the student wrote Filipino/Taglish. */
  language: "EN" | "TL";
  hedged: boolean; // "maybe", "i think", "?" on an answer
  frustrated: boolean;
  confused: boolean;
  /** The student explained how they got there ("because I added..."). */
  givesReasoning: boolean;
  /** Parsed attempt, if any. */
  attempt?: {
    raw: string;
    number?: number;
    choiceLetter?: string;
    /** true/false answers ("true", "mali", "tama"). */
    truth?: boolean;
  };
  /** A problem the student typed themselves. */
  ownProblem?: ParsedProblem;
}

/**
 * "+ - * /" are two-number integer expressions. The other values encode further problem kinds:
 * "abs" |a|, "opp" opposite of a, "x+" x + a = b, "x-" x - a = b, "max"/"min" which of a, b is greater/less,
 * ">" / "<" a true/false comparison statement "a > b".
 */
export type Operator = "+" | "-" | "*" | "/" | "abs" | "opp" | "x+" | "x-" | "max" | "min" | ">" | "<";
export type ProblemKindTag = "BINARY" | "ABS" | "OPPOSITE" | "EQUATION" | "COMPARE";

export interface ParsedProblem {
  /** Defaults to BINARY when absent. */
  kind?: ProblemKindTag;
  a: number;
  b: number;
  op: Operator;
  /** Variable letter for equations (display only). */
  variable?: string;
  /** Display form with parenthesised negatives, e.g. "(-8) + 13". */
  display: string;
  expected: number;
}

export type MistakeDiagnosis =
  | "SIGN_ERROR" // right size, wrong sign
  | "IGNORED_SIGNS" // computed with absolute values
  | "ADDED_MAGNITUDES" // added absolute values when signs differ
  | "WRONG_OPERATION"
  | "ABS_KEPT_SIGN" // |-a| given as -a: absolute value is never negative
  | "OPPOSITE_SAME_NUMBER" // gave the number itself as its opposite
  | "EQ_WRONG_INVERSE" // did the same operation instead of undoing it
  | "COMPARED_MAGNITUDE" // judged negatives by size instead of position on the number line
  | "CALCULATION_SLIP" // off by a small amount
  | "UNKNOWN_INCORRECT";

export type AttemptKind = "CORRECT" | "INCORRECT" | "NONE";

export interface AnswerEvaluation {
  kind: AttemptKind;
  diagnosis?: MistakeDiagnosis;
  /** The student's answer in display form. */
  attempted?: string;
  /** Plain-language fact we may state about the attempt WITHOUT revealing the answer. */
  safeObservation?: string;
}

export type TutorStrategy =
  | "OPEN_LESSON" // first turn on a lesson with no problem
  | "OPEN_PROBLEM" // first turn on a problem
  | "ASK_WHAT_THEY_THINK" // elicit current thinking
  | "ACTIVATE_PRIOR" // recall a prerequisite idea
  | "VISUAL_NUMBER_LINE"
  | "DECOMPOSE_STEPS" // one small step at a time
  | "WORKED_ANALOGOUS" // fully solved example with DIFFERENT numbers
  | "REAL_CONTEXT" // everyday framing (money, temperature, elevation)
  | "TARGET_MISCONCEPTION" // diagnosis-specific question
  | "ASK_FOR_REASONING" // "walk me through how you got that"
  | "CONFIRM_AND_PROBE" // right answer: confirm, then ask why
  | "TRANSFER_PROBLEM" // new related problem, no help
  | "SIMPLER_PROBLEM"
  | "HARDER_PROBLEM"
  | "REVIEW_KEY_IDEAS"
  | "REDIRECT_TO_THINKING" // asked for the answer
  | "EMPATHIZE_AND_SHRINK" // frustration: one tiny step
  | "NUDGE_TO_RESPOND" // student only acknowledged
  | "SUGGEST_TEACHER" // stuck for long: recommend asking the teacher
  | "REDIRECT_OFF_TOPIC"
  | "CELEBRATE_AND_NEXT"; // verified independent success

export type ConversationPhase = "OPENING" | "DIAGNOSING" | "SCAFFOLDING" | "CONFIRMING" | "TRANSFER" | "MASTERED_FOR_NOW";

export interface TransferProblem {
  problem: ParsedProblem;
  attempts: number;
  kind: "TRANSFER" | "SIMPLER" | "HARDER";
}

export interface ConversationState {
  version: 1;
  turn: number;
  phase: ConversationPhase;
  /** 0 = minimal help ... 5 = maximal help. */
  scaffold: number;
  consecutiveConfusion: number;
  consecutiveWrong: number;
  consecutiveAnswerRequests: number;
  correctStreak: number;
  frustration: number; // 0..3
  /** The problem currently under discussion (the question, or a student/transfer problem). */
  activeProblem?: ParsedProblem;
  activeProblemSource?: "QUESTION" | "STUDENT" | "TUTOR";
  /** The original problem (question or student-typed); transfer problems are derived from it. */
  baseProblem?: ParsedProblem;
  /** Problem key used to reset per-problem counters when the problem changes. */
  problemKey?: string;
  wrongOnProblem: number;
  strategyHistory: Array<{ turn: number; strategy: TutorStrategy }>;
  /** Everything the tutor has already told the student; used to avoid repeating itself. */
  hintsGiven: Array<{ turn: number; strategy: TutorStrategy; scaffold: number }>;
  recentTutorMessages: string[];
  lastTutorQuestion?: string;
  awaiting: "ANSWER" | "RESPONSE" | "NONE";
  lastStudentIntent?: StudentIntent;
  lastDiagnosis?: MistakeDiagnosis;
  /** The diagnosis before the latest one, to detect a NEW kind of mistake versus the same one repeating. */
  previousDiagnosis?: MistakeDiagnosis;
  diagnoses: Partial<Record<MistakeDiagnosis, number>>;
  examplesGiven: number;
  pendingTransfer?: TransferProblem;
  independentSuccesses: number; // correct transfer answers
  needsTeacherAttention: boolean;
  /** Short log of what the student said, for "what did the student just say" memory. */
  recentStudentStatements: string[];
  /** Sticky: the student has written Filipino/Taglish, so empathy/feedback is phrased in Taglish. */
  language: "EN" | "TL";
  /** Problem keys already posed or solved, so new problems are always new. */
  usedProblems: string[];
  hintsOnProblem: number;
}

export interface ResponsePlan {
  /** Phase 40: topic coaching for the question (polygons, percentages, rates...) when no integer problem could be parsed from it. */
  coach?: import("./coaching").Coach;
  /** The question's numeric answer, so a worked example never reuses it. */
  coachAvoid?: number;
  strategy: TutorStrategy;
  scaffold: number;
  phase: ConversationPhase;
  /** Plain-language instruction for the LLM (and a spec for the local realizer). */
  directive: string;
  /** Hard constraints the output is checked against. */
  mustAskOneQuestion: boolean;
  mayStateFinalAnswer: boolean;
  /** When posing a new problem, the exact text the tutor must present. */
  problemToPose?: ParsedProblem;
  /** Answer the tutor must not reveal. */
  protectedAnswer?: string;
  protectedAnswerAliases: string[];
  /** Strategies recently used; the response must not simply repeat them. */
  avoidStrategies: TutorStrategy[];
  /** Reason the strategy changed, for logs/analytics. */
  rationale: string;
  intent: StudentIntent;
  evaluation: AnswerEvaluation;
  needsTeacherAttention: boolean;
  /** The problem the conversation is currently about (if any). Its answer is protected. */
  activeProblem?: ParsedProblem;
  /** For WORKED_ANALOGOUS: a fully solved example with different numbers. */
  example?: { problem: ParsedProblem; steps: string[] };
  /** Short quote of what the student just said, to acknowledge specifically. */
  studentQuote?: string;
  /** How many hints/scaffolds have been given on the current problem (including this one). */
  hintOrdinal: number;
  /** Diagnosed misconception, if the student just made one. */
  diagnosis?: MistakeDiagnosis;
}

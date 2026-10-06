/**
 * Server-side grading for multiple-choice lesson blocks (CHECKPOINT and QUESTION).
 * The correct answer and explanation live in the block's metadata JSON. Students must never receive
 * the correct answer before they answer, and their own claim of correctness is never trusted.
 */

export const GRADABLE_BLOCK_TYPES = ["CHECKPOINT", "QUESTION"] as const;
export const MAX_ANSWER_LENGTH = 200;

export interface GradableBlock {
  id: string;
  type: string;
  metadata?: string | null;
}

export interface ParsedChoice {
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export function isGradableType(type: string): boolean {
  return (GRADABLE_BLOCK_TYPES as readonly string[]).includes(type);
}

export const normalizeAnswer = (s: string): string => s.trim().replace(/\s+/g, " ").toLowerCase();

function parseMetadata(metadata?: string | null): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    const v = JSON.parse(metadata);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Returns null when the block is not a well-formed multiple-choice item (it cannot be graded). */
export function parseChoiceBlock(block: GradableBlock): ParsedChoice | null {
  if (!isGradableType(block.type)) return null;
  const m = parseMetadata(block.metadata);
  if (!m || !Array.isArray(m.options) || typeof m.correctAnswer !== "string") return null;
  const options = m.options.filter((o): o is string => typeof o === "string" && o.trim().length > 0);
  if (options.length < 2 || options.length !== m.options.length) return null;
  if (new Set(options.map(normalizeAnswer)).size !== options.length) return null;
  if (!options.some((o) => normalizeAnswer(o) === normalizeAnswer(m.correctAnswer as string))) return null;
  return {
    options,
    correctAnswer: m.correctAnswer,
    explanation: typeof m.explanation === "string" ? m.explanation : "",
  };
}

export type GradeResult =
  | { ok: true; isCorrect: boolean; feedback: string; correctAnswer?: string; chosen: string }
  | { ok: false; status: 400 | 422; error: string };

export function gradeChoiceAnswer(block: GradableBlock, answer: unknown): GradeResult {
  if (!isGradableType(block.type)) return { ok: false, status: 400, error: "This section is not a question." };
  const parsed = parseChoiceBlock(block);
  if (!parsed) return { ok: false, status: 422, error: "This question is not set up correctly yet. Please tell your teacher." };
  if (typeof answer !== "string" || !answer.trim() || answer.length > MAX_ANSWER_LENGTH) {
    return { ok: false, status: 400, error: "Choose one of the answers." };
  }
  const chosen = parsed.options.find((o) => normalizeAnswer(o) === normalizeAnswer(answer));
  if (!chosen) return { ok: false, status: 400, error: "That is not one of the answer choices." };
  const isCorrect = normalizeAnswer(chosen) === normalizeAnswer(parsed.correctAnswer);
  return {
    ok: true,
    isCorrect,
    chosen,
    feedback: parsed.explanation,
    // The right answer is only ever shown to a student who found it.
    ...(isCorrect ? { correctAnswer: parsed.correctAnswer } : {}),
  };
}

/** Student-facing copy of a block: no correct answer and no explanation (returned by the grader instead). */
export function toStudentBlockView<T extends GradableBlock>(block: T): T {
  if (!isGradableType(block.type)) return block;
  const m = parseMetadata(block.metadata);
  if (!m) return { ...block, metadata: undefined };
  const { correctAnswer, explanation, ...safe } = m;
  return { ...block, metadata: JSON.stringify(safe) };
}

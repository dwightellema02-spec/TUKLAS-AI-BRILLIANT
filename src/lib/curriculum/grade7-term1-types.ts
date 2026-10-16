/**
 * Grade 7 Mathematics, Term 1 (Weeks 1-6) — data shapes for the curriculum that is loaded into a real database.
 *
 * Source of the scope and sequence: the DepEd MATATAG Grade 7 Mathematics Three-Term Budget of Work (Term 1, weeks 1-6) supplied
 * by the school. All lesson text, examples and questions here are ORIGINAL (written for this platform, with every answer
 * computed by code and re-checked by tests). The DepEd Lesson Exemplars for Q1 Lessons 1-6 are teacher materials with their own
 * usage terms; they are referenced (week, competency) but not reproduced.
 */

export type SeedBlockType = "TEXT" | "IMAGE" | "VIDEO" | "EXAMPLE" | "QUESTION" | "INTERACTIVE" | "HINT" | "CHECKPOINT" | "PRACTICE" | "SUMMARY";

export interface SeedBlock {
  type: SeedBlockType;
  title: string;
  content: string;
  /** Structured data: CHECKPOINT {question, options, correctAnswer, explanation}; EXAMPLE {problem, steps, answer}; IMAGE {url, alt, caption}. */
  metadata?: Record<string, unknown>;
}

export interface SeedSkill {
  key: string;
  title: string;
  description: string;
  /** 1.0 - 5.0 */
  difficulty: number;
  /** key of the competency (week) this skill belongs to */
  competency: string;
  prerequisites: string[];
}

export interface SeedCompetency {
  key: string;
  code: string;
  statement: string;
  unit: "A" | "B";
  week: number;
}

export type SeedQuestion =
  | { key: string; skill: string; type: "MULTIPLE_CHOICE"; prompt: string; difficulty: "EASY" | "MEDIUM" | "HARD"; explanation: string; choices: string[]; correctIndex: number }
  | { key: string; skill: string; type: "NUMERIC_INPUT"; prompt: string; difficulty: "EASY" | "MEDIUM" | "HARD"; explanation: string; answer: number; tolerance?: number; unit?: string }
  | { key: string; skill: string; type: "TRUE_FALSE"; prompt: string; difficulty: "EASY" | "MEDIUM" | "HARD"; explanation: string; answer: boolean };

export interface SeedLesson {
  key: string;
  week: number;
  /** Day of the week (1-5) in the Lesson Exemplar, when the lesson covers one day of it. */
  day?: number;
  /** false = loaded as a DRAFT that students cannot see (for a week whose Lesson Exemplar has not been supplied yet). Default true. */
  published?: boolean;
  unit: "A" | "B";
  title: string;
  description: string;
  objectives: string[];
  minutes: number;
  skills: string[];
  blocks: SeedBlock[];
  /** Question keys placed in the lesson's practice set (the rest stay in the question bank). */
  practice: string[];
  teacherNote: string;
}

export interface SeedUnit {
  key: "A" | "B";
  title: string;
  description: string;
  sequenceOrder: number;
}

/**
 * Tuklas AI - Mastery Engine Type Definitions
 * Phase 10: Multi-dimensional, Evidence-based Mastery Types
 */

import type { QuestionDifficulty, QuestionType } from "@prisma/client";

export type MasteryLevel =
  | "NOT_STARTED"
  | "LEARNING"
  | "DEVELOPING"
  | "PROFICIENT"
  | "MASTERED";

export interface DifficultyStats {
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface QuestionTypeStats {
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface PrerequisiteMasteryCheck {
  prerequisiteSkillId: string;
  prerequisiteSkillTitle: string;
  status: MasteryLevel;
  accuracy: number;
  isWeak: boolean;
}

export interface MasteryMistakeEvidence {
  hasMistakeAnalysis: boolean;
  totalAnalyses: number;
  primaryCategory?: string;
  hasRepeatedConceptual: boolean;
  hasRepeatedSignErrors: boolean;
  hasPrerequisiteGaps: boolean;
  hasApplicationDifficulty: boolean;
  inconsistentPerformance: boolean;
  latestObservation?: string;
  latestPattern?: string;
}

export interface MasteryAdaptiveEvidence {
  totalRecommendations: number;
  lastDecisionType?: string;
  lastTargetDifficulty?: string;
  remediationsCompleted: number;
  prerequisiteReviewsTriggered: number;
}

export interface MasteryEvidenceBundle {
  studentId: string;
  skillId: string;
  skillTitle: string;
  lessonId?: string;
  lessonTitle?: string;

  // Performance
  totalAttempts: number;
  correctAttempts: number;
  incorrectAttempts: number;
  overallAccuracy: number;
  recentAccuracy: number;
  historicalAccuracy: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;

  // Difficulty performance
  difficultyBreakdown: Record<QuestionDifficulty, DifficultyStats>;

  // Question Type diversity
  questionTypeBreakdown: Record<string, QuestionTypeStats>;
  distinctQuestionTypesCount: number;

  // Behavioral signals
  totalHintsUsed: number;
  totalRetries: number;
  practiceSessionsCompleted: number;

  // Mistake Analyzer signals (Phase 8)
  mistakes: MasteryMistakeEvidence;

  // Adaptive Learning signals (Phase 9)
  adaptive: MasteryAdaptiveEvidence;

  // Prerequisite DAG status (Phase 4)
  prerequisites: PrerequisiteMasteryCheck[];
  hasPrerequisiteConcern: boolean;

  // Application-oriented questions score
  applicationScore: number; // e.g. performance on word problems, multi-step, numeric input

  // Calculated consistency index (0.0 to 1.0)
  consistencyScore: number;
}

export interface MasteryExplanationDTO {
  level: MasteryLevel;
  summary: string;
  why: string;
  nextStep: string;
  encouragement: string;
}

export interface MasteryEvaluationResult {
  studentId: string;
  skillId: string;
  level: MasteryLevel;
  evidenceSummary: string;
  accuracy: number;
  recentAccuracy: number;
  consistencyScore: number;
  applicationScore: number;
  attemptCount: number;
  masteryVersion: string;
  ruleCode: string;
  ruleDescription: string;
  explanation: MasteryExplanationDTO;
  flags: {
    prerequisiteConcern: boolean;
    limitedQuestionTypeEvidence: boolean;
    recentPerformanceDecline: boolean;
    activeConceptualMisconception: boolean;
    calculationSlipOnly: boolean;
  };
  metrics: {
    difficulty: Record<QuestionDifficulty, DifficultyStats>;
    questionTypes: Record<string, QuestionTypeStats>;
    consecutiveCorrect: number;
    hintsUsed: number;
  };
}

export interface SkillMasteryHistoryDTO {
  id: string;
  skillMasteryId: string;
  previousStatus: MasteryLevel | null;
  newStatus: MasteryLevel;
  reason: string;
  evidenceSummary?: string | null;
  masteryVersion: string;
  createdAt: string;
}

export interface SkillMasteryDTO {
  id: string;
  studentId: string;
  studentName?: string;
  skillId: string;
  skillTitle: string;
  lessonId?: string;
  lessonTitle?: string;
  status: MasteryLevel;
  evidenceSummary: string;
  accuracy: number;
  recentAccuracy: number;
  consistencyScore: number;
  applicationScore: number;
  attemptCount: number;
  masteryVersion: string;
  lastEvaluatedAt: string;
  explanation: MasteryExplanationDTO;
  metadata?: {
    ruleCode?: string;
    ruleDescription?: string;
    flags?: {
      prerequisiteConcern: boolean;
      limitedQuestionTypeEvidence: boolean;
      recentPerformanceDecline: boolean;
      activeConceptualMisconception: boolean;
    };
    difficulty?: Record<QuestionDifficulty, DifficultyStats>;
    questionTypes?: Record<string, QuestionTypeStats>;
  };
  history?: SkillMasteryHistoryDTO[];
}

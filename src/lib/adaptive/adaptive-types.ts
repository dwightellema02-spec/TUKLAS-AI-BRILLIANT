/**
 * Phase 9: Adaptive Learning Engine - Type Definitions
 */

import type {
  AdaptiveDecisionType,
  AdaptiveSource,
  AdaptiveRecommendationStatus,
  AdaptiveConfidence,
  RecommendedActivityType,
  QuestionDifficulty,
  MistakeCategory,
} from "@prisma/client";

export type {
  AdaptiveDecisionType,
  AdaptiveSource,
  AdaptiveRecommendationStatus,
  AdaptiveConfidence,
  RecommendedActivityType,
  QuestionDifficulty,
  MistakeCategory,
};

/** Collected Practice Evidence */
export interface PracticeEvidence {
  totalAttempts: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracy: number; // 0.0 to 1.0
  retryCount: number;
  hintUsageCount: number;
  averageTimeTakenMs?: number;
  recentTrend: "IMPROVING" | "DECLINING" | "STABLE" | "INSUFFICIENT_DATA";
  difficultyCounts: Record<QuestionDifficulty, { total: number; correct: number }>;
  lastAttemptAt?: Date;
}

/** Collected Skill and Curriculum Evidence */
export interface SkillEvidence {
  skillId: string;
  skillTitle: string;
  lessonId?: string | null;
  lessonTitle?: string | null;
  prerequisites: Array<{
    prerequisiteSkillId: string;
    prerequisiteTitle: string;
    accuracy: number;
    attemptCount: number;
    isWeak: boolean;
  }>;
}

/** Collected Mistake Analysis Evidence from Phase 8 */
export interface MistakeEvidence {
  hasAnalysis: boolean;
  primaryCategory?: MistakeCategory;
  categoryLabel?: string;
  observation?: string;
  pattern?: string;
  confidence?: number;
  repeatedSignErrors: boolean;
  conceptualGap: boolean;
  prerequisiteGap: boolean;
  calculationErrorOnly: boolean;
  rawRecommendations?: string;
}

/** Learning Path Context from Phase 4 */
export interface LearningPathEvidence {
  currentLessonId?: string | null;
  isLessonCompleted: boolean;
  completedLessonsCount: number;
  totalLessonsInUnit: number;
  nextRecommendedLessonId?: string | null;
}

/** Complete Aggregated Evidence Snapshot passed to Decision Rules */
export interface AdaptiveEvidenceBundle {
  studentId: string;
  skillId: string;
  lessonId?: string | null;
  practice: PracticeEvidence;
  skill: SkillEvidence;
  mistake: MistakeEvidence;
  learningPath: LearningPathEvidence;
  collectedAt: Date;
}

/** Raw Decision Output from Deterministic Rules Engine */
export interface RuleEvaluationResult {
  decisionType: AdaptiveDecisionType;
  confidence: AdaptiveConfidence;
  ruleCode: string;
  ruleDescription: string;
  targetDifficulty?: QuestionDifficulty;
  weakPrerequisiteSkillId?: string;
  weakPrerequisiteTitle?: string;
  recommendedActivityType: RecommendedActivityType;
  requiresRemediation: boolean;
}

/** Student-Friendly Explanation (from AI or Deterministic Fallback) */
export interface AdaptiveExplanation {
  message: string;
  reason: string;
  nextStep: string;
  encouragement: string;
}

/** DTO for Student & Teacher UI */
export interface AdaptiveRecommendationDTO {
  id: string;
  studentId: string;
  studentName?: string;
  skillId?: string | null;
  skillTitle?: string;
  lessonId?: string | null;
  lessonTitle?: string;
  decisionType: AdaptiveDecisionType;
  reason: string;
  evidenceSummary: string;
  confidence: AdaptiveConfidence;
  recommendedActivityType: RecommendedActivityType;
  recommendedActivityId?: string | null;
  recommendedActivityTitle?: string;
  recommendedPracticeSetId?: string | null;
  source: AdaptiveSource;
  status: AdaptiveRecommendationStatus;
  targetDifficulty?: QuestionDifficulty | null;
  explanation?: AdaptiveExplanation;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  overrides?: Array<{
    id: string;
    teacherId: string;
    teacherName?: string;
    originalDecision: AdaptiveDecisionType;
    overrideDecision: AdaptiveDecisionType;
    reason: string;
    createdAt: string;
  }>;
}

/** Teacher Override Input */
export interface TeacherOverrideParams {
  recommendationId: string;
  teacherId: string;
  overrideDecision: AdaptiveDecisionType;
  reason: string;
  targetDifficulty?: QuestionDifficulty;
  recommendedActivityType?: RecommendedActivityType;
  recommendedActivityId?: string;
}

/** Generation Trigger Context */
export interface GenerateRecommendationParams {
  studentId: string;
  skillId?: string;
  lessonId?: string;
  trigger?: "PRACTICE_COMPLETED" | "CHECKPOINT_SUBMITTED" | "STUDENT_REQUESTED" | "TEACHER_REQUESTED";
  forceRefresh?: boolean;
}

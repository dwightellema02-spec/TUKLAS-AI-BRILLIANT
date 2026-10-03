/**
 * Tuklas AI - Student Dashboard Types
 * Phase 11: Real-time Personalized Learning Environment
 */

import type { AdaptiveRecommendationDTO } from "@/lib/adaptive/adaptive-types";
import type { MasteryLevel, SkillMasteryDTO } from "@/lib/mastery/mastery-types";

export type ContinueLearningState = "NO_PROGRESS" | "IN_PROGRESS" | "COMPLETED";

export interface ContinueLearningDTO {
  state: ContinueLearningState;
  lessonId: string;
  title: string;
  description: string;
  progressPercentage: number;
  currentSectionIndex: number;
  totalSections: number;
  currentSectionTitle?: string;
  completedBlockIds: string[];
  lastActivityAt?: string;
  ctaLabel: string;
  estimatedMinutes?: number;
}

export interface UnitProgressDTO {
  id: string;
  title: string;
  description: string;
  completedLessons: number;
  totalLessons: number;
  progressPercentage: number;
}

export interface CurriculumContextDTO {
  subject: string;
  grade: string;
  term: string;
  unit: UnitProgressDTO;
}

export interface ProgressSummaryDTO {
  totalSkills: number;
  masteryCounts: {
    NOT_STARTED: number;
    LEARNING: number;
    DEVELOPING: number;
    PROFICIENT: number;
    MASTERED: number;
  };
  overallAccuracy: number;
  totalAttempts: number;
  completedLessonsCount: number;
  totalLessonsCount: number;
  skills: Array<{
    id: string;
    title: string;
    status: MasteryLevel;
    accuracy: number;
    recentAccuracy: number;
    attemptCount: number;
    consistencyScore: number;
  }>;
}

export type RecentActivityType =
  | "PRACTICE_SESSION"
  | "QUESTION_ATTEMPT"
  | "CHECKPOINT"
  | "LESSON_COMPLETED"
  | "AI_TUTOR_SESSION";

export interface RecentActivityItemDTO {
  id: string;
  type: RecentActivityType;
  title: string;
  description: string;
  score?: string;
  accuracy?: number;
  isCorrect?: boolean;
  statusBadge?: string;
  timestamp: string;
  url?: string;
  actionLabel?: string;
}

export interface QuickHelpTopicDTO {
  id: string;
  topic: string;
  prompt: string;
  category: "CONCEPT" | "PROCEDURE" | "PRACTICE" | "APPLICATION";
}

export interface StudentDashboardDataDTO {
  student: {
    id: string;
    name: string;
    email: string;
    role: string;
    gradeLevel?: number;
  };
  curriculum: CurriculumContextDTO;
  continueLearning: ContinueLearningDTO;
  adaptiveRecommendation: AdaptiveRecommendationDTO | null;
  progressSummary: ProgressSummaryDTO;
  recentActivity: RecentActivityItemDTO[];
  quickHelpTopics: QuickHelpTopicDTO[];
}

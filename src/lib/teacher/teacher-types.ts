/**
 * Tuklas AI - Teacher Dashboard Type Definitions
 * Phase 12: Teacher Control Center, Authorization, and Class Analytics
 */

import type { MasteryLevel } from "@/lib/mastery/mastery-types";
import type { AdaptiveRecommendationDTO } from "@/lib/adaptive/adaptive-types";

export interface TeacherProfileDTO {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

export interface ClassSummaryDTO {
  id: string;
  name: string;
  gradeLevel: number;
  subject: string;
  schoolYear: string;
  totalStudents: number;
  activeStudents: number;
  averageProgress: number;
}

export interface StudentListItemDTO {
  id: string;
  name: string;
  email: string;
  gradeLevel: number;
  classrooms: Array<{ id: string; name: string }>;
  currentLesson: {
    id: string;
    title: string;
    progressPercentage: number;
    state: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  } | null;
  primaryMastery: {
    skillId: string;
    skillTitle: string;
    status: MasteryLevel;
  } | null;
  overallAccuracy: number;
  lastActivityAt: string | null;
  lastActivityDisplay: string;
  status: "ACTIVE" | "NEEDS_SUPPORT" | "INACTIVE";
}

export interface PaginatedStudentsDTO {
  students: StudentListItemDTO[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

export interface StudentDetailDTO {
  student: {
    id: string;
    name: string;
    email: string;
    gradeLevel: number;
    classrooms: Array<{ id: string; name: string }>;
  };
  currentLesson: {
    id: string;
    title: string;
    progressPercentage: number;
    startedAt?: string;
    lastActivityAt?: string;
  } | null;
  learningPathNodes: Array<{
    lessonId: string;
    title: string;
    state: string;
    progressPercentage: number;
  }>;
  masteries: Array<{
    skillId: string;
    skillTitle: string;
    status: MasteryLevel;
    accuracy: number;
    recentAccuracy: number;
    attemptCount: number;
    consistencyScore: number;
    summary?: string;
  }>;
  mistakePatterns: Array<{
    category: string;
    categoryLabel: string;
    count: number;
    examples: string[];
    suggestedRemediation?: string;
  }>;
  adaptiveRecommendations: AdaptiveRecommendationDTO[];
  recentPractice: Array<{
    id: string;
    title: string;
    score: string;
    accuracy: number;
    status: string;
    completedAt?: string;
  }>;
}

export interface MasteryDistributionDTO {
  skillId: string;
  skillTitle: string;
  counts: {
    MASTERED: number;
    PROFICIENT: number;
    DEVELOPING: number;
    LEARNING: number;
    NOT_STARTED: number;
  };
  totalEvaluated: number;
}

export interface DifficultSkillDTO {
  skillId: string;
  skillTitle: string;
  developingOrLearningCount: number;
  totalStudents: number;
  averageAccuracy: number;
  commonMistakeCategory?: string;
  reason: string;
}

export interface StudentSupportSignalDTO {
  studentId: string;
  studentName: string;
  classroomName: string;
  signalType:
    | "REPEATED_MISTAKES"
    | "LOW_ACCURACY"
    | "INSUFFICIENT_ACTIVITY"
    | "PERSISTENT_DEVELOPING"
    | "PREREQUISITE_STRUGGLE";
  severity: "HIGH" | "MEDIUM" | "LOW";
  details: string;
  skillTitle?: string;
  suggestedAction: string;
}

export interface TeacherActivityItemDTO {
  id: string;
  type: "LESSON_COMPLETED" | "PRACTICE_SUBMITTED" | "MASTERY_IMPROVED" | "LESSON_PUBLISHED" | "RECOMMENDATION_TRIGGERED";
  title: string;
  description: string;
  timestamp: string;
  studentName?: string;
  badge?: string;
}

export interface TeacherDashboardDataDTO {
  teacher: TeacherProfileDTO;
  stats: {
    totalStudents: number;
    activeStudents: number;
    recentlyActiveStudents: number;
    inactiveStudents: number;
    publishedLessonsCount: number;
    draftLessonsCount: number;
    activeClassesCount: number;
  };
  classes: ClassSummaryDTO[];
  classProgress: {
    lessonsCompletedTotal: number;
    practiceSessionsTotal: number;
    averageClassAccuracy: number;
  };
  masteryDistribution: MasteryDistributionDTO[];
  difficultSkills: DifficultSkillDTO[];
  commonMistakes: Array<{
    category: string;
    label: string;
    count: number;
  }>;
  needsAttention: StudentSupportSignalDTO[];
  recentActivity: TeacherActivityItemDTO[];
}

export interface TeacherAIQueryRequest {
  prompt: string;
  classId?: string;
  studentId?: string;
}

export interface TeacherAIQueryResponse {
  answer: string;
  groundedMetrics: Record<string, any>;
  suggestedActions: string[];
}

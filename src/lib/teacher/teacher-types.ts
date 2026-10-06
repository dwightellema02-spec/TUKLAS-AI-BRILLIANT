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
  /** Whether a teacher/admin has recorded guardian consent for this student. */
  guardianConsent?: boolean;
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
  /** Percent from real scored practice, or null when the student has none yet. */
  overallAccuracy: number | null;
  lastActivityAt: string | null;
  lastActivityDisplay: string;
  status: "ACTIVE" | "NEEDS_SUPPORT" | "INACTIVE" | "NO_DATA";
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
  /** Latest graded result of each assessment this student took. */
  assessmentResults: Array<{ assessmentId: string; title: string; type: string; scorePercent: number; isPassed: boolean; submittedAt: string }>;
  /** Why this student may need support, with the numbers behind it; null when nothing in the evidence calls for it. */
  support: StudentSupportSignalDTO | null;
  tutorUse: { conversations: number; studentMessages: number; lastAt: string | null; flaggedConversations: number };
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
  /** Mean mastery accuracy over students with evidence, or null if unavailable. */
  averageAccuracy: number | null;
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
    | "LOW_ASSESSMENT"
    | "INSUFFICIENT_ACTIVITY"
    | "PERSISTENT_DEVELOPING"
    | "PREREQUISITE_STRUGGLE"
    | "TUTOR_FLAGGED"
    | "NOT_STARTED"
    | "DECLINING";
  severity: "HIGH" | "MEDIUM" | "LOW";
  details: string;
  /** Every fact behind the flag, each with its numbers. */
  evidence?: string[];
  skillTitle?: string;
  suggestedAction: string;
}

export interface GroupRecommendationDTO {
  skillId: string;
  skillTitle: string;
  students: Array<{ id: string; name: string }>;
  studentCount: number;
  withEvidence: number;
  commonMistake?: { category: string; label: string; count: number };
  evidence: string;
  suggestedAction: string;
}

export interface AssessmentPerformanceDTO {
  assessmentId: string;
  title: string;
  type: string;
  status: string;
  assigned: number;
  completed: number;
  /** Mean of each student's latest graded score; null when nobody has finished. */
  meanScorePercent: number | null;
  passRate: number | null;
}

export interface LessonPerformanceDTO {
  lessonId: string;
  title: string;
  studentsStarted: number;
  studentsCompleted: number;
  totalStudents: number;
  /** Practice accuracy on this lesson's practice sets; null when there is none. */
  practiceAccuracy: number | null;
  practiceQuestions: number;
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
    /** null when no student has scored practice yet. */
    averageClassAccuracy: number | null;
  };
  masteryDistribution: MasteryDistributionDTO[];
  difficultSkills: DifficultSkillDTO[];
  commonMistakes: Array<{
    category: string;
    label: string;
    count: number;
  }>;
  needsAttention: StudentSupportSignalDTO[];
  /** Number of students with a signal (the list above is complete, not truncated). */
  needsAttentionTotal: number;
  /** Plain-language limits of the evidence behind this view (for example answers not linked to a skill). */
  dataNotes: string[];
  groupRecommendations: GroupRecommendationDTO[];
  assessmentPerformance: AssessmentPerformanceDTO[];
  lessonPerformance: LessonPerformanceDTO[];
  /** The class this view is limited to, if any. */
  classFilter?: { id: string; name: string };
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

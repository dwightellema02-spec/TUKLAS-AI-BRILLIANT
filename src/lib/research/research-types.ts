/**
 * Tuklas AI - Research & Assessment Analytics Types
 * Phase 14: Assessment & Research Analytics Engine
 */

export type CognitiveLevel = "KNOWLEDGE" | "PROCEDURAL" | "APPLICATION" | "HIGHER_ORDER";

export type AssessmentType =
  | "DIAGNOSTIC"
  | "FORMATIVE"
  | "SUMMATIVE"
  | "PRACTICE"
  | "PRE_TEST"
  | "POST_TEST";

export type AssessmentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type ResearchMetricType = "ACCURACY" | "UNDERSTANDING" | "APPLICATION" | "CONSISTENCY";

export type ResearchMetricLevel =
  | "INSUFFICIENT_EVIDENCE"
  | "LOW"
  | "DEVELOPING"
  | "PROFICIENT"
  | "HIGH";

export interface ResearchMetricResult {
  metric: ResearchMetricType;
  value: number; // 0.0 to 1.0 (or NaN/0 if insufficient evidence)
  level: ResearchMetricLevel;
  confidence: number; // 0.0 to 1.0
  evidenceCount: number;
  calculationVersion: string;
  calculatedAt: string;
  summary: string;
  evidence: {
    totalAttempts: number;
    correctAttempts: number;
    hintFreeAttempts?: number;
    checkpointCount?: number;
    applicationAttempts?: number;
    applicationCorrect?: number;
    consistencyVariance?: number;
    streakStability?: number;
    misconceptionCount?: number;
    details: string;
  };
}

export interface StudentResearchProfile {
  studentId: string;
  studentName: string;
  gradeLevel?: number;
  metrics: {
    accuracy: ResearchMetricResult;
    understanding: ResearchMetricResult;
    application: ResearchMetricResult;
    consistency: ResearchMetricResult;
  };
  attemptCount: number;
  skillsEvaluated: number;
  difficultSkillCount: number;
  topMisconception?: string;
  calculatedAt: string;
  calculationVersion: string;
}

export interface PrePostComparisonResult {
  studentId?: string;
  studentName?: string;
  classroomId?: string;
  classroomName?: string;
  preTest: {
    assessmentId: string;
    title: string;
    totalStudents: number;
    /** null when no student has a graded attempt: never a made-up number. */
    averageScorePercent: number | null;
    completedAt?: string;
  };
  postTest: {
    assessmentId: string;
    title: string;
    totalStudents: number;
    averageScorePercent: number | null;
    completedAt?: string;
  };
  comparison: {
    scoreDifferencePoints: number | null; // e.g. +14.5 percentage points
    relativeGrowthPercent: number | null;
    observedTrend: "IMPROVEMENT" | "MAINTAINED" | "DECLINE" | "INSUFFICIENT_DATA";
    description: string;
  };
  skillBreakdown: Array<{
    skillId: string;
    skillTitle: string;
    preAccuracy: number;
    postAccuracy: number;
    pointChange: number;
  }>;
  calculatedAt: string;
  calculationVersion: string;
}

export interface DifficultSkillEvidence {
  skillId: string;
  skillCode?: string;
  skillTitle: string;
  gradeLevel: number;
  lessonId?: string;
  lessonTitle?: string;
  accuracy: number;
  evidenceCount: number;
  affectedStudentCount: number;
  totalStudentsEvaluated: number;
  primaryMisconceptions: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  hintDependenceRate: number;
  masteryDistribution: {
    notStarted: number;
    learning: number;
    developing: number;
    proficient: number;
    mastered: number;
  };
  flagReason: string;
}

export interface MistakeAggregateItem {
  category: string;
  count: number;
  percentage: number;
  affectedStudentCount: number;
  affectedSkillCount: number;
  sampleQuestionPrompts: string[];
  recommendedPedagogicalAction: string;
}

export interface InterventionObservationItem {
  interventionType: string; // e.g. "AI_TUTOR_HINT" | "REMEDIATION_PRACTICE" | "TEACHER_OVERRIDE"
  studentId: string;
  studentName: string;
  skillId: string;
  skillTitle: string;
  timestamp: string;
  beforeEvidence: {
    accuracy: number;
    attempts: number;
    description: string;
  };
  afterEvidence: {
    accuracy: number;
    attempts: number;
    description: string;
  };
  observedChange: {
    pointChange: number;
    observationStatement: string; // Non-causal wording
  };
}

export interface TimeSeriesDataPoint {
  date: string; // YYYY-MM-DD
  accuracy: number;
  /** Not computed per day (too little evidence per day); kept for compatibility. */
  understanding: number | null;
  application: number | null;
  consistency: number | null;
  attemptCount: number;
  activeStudents: number;
}

export interface AssessmentItemDTO {
  id: string;
  assessmentId: string;
  questionId: string;
  sequenceOrder: number;
  points: number;
  cognitiveLevel: CognitiveLevel;
  question: {
    id: string;
    prompt: string;
    type: string;
    difficulty: string;
    skillId?: string;
    lessonId?: string;
    explanation?: string;
    options?: any[];
    // Server-side redacted for students!
    correctAnswer?: any;
  };
}

export interface AssessmentDTO {
  id: string;
  title: string;
  description?: string;
  type: AssessmentType;
  status: AssessmentStatus;
  timeLimitMinutes?: number;
  passingScorePercent: number;
  authorId: string;
  authorName?: string;
  lessonId?: string;
  lessonTitle?: string;
  gradeLevel: number;
  itemCount: number;
  totalPoints: number;
  items?: AssessmentItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentAttemptResultDTO {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentType: AssessmentType;
  studentId: string;
  studentName?: string;
  status: string;
  score: number;
  maxScore: number;
  scorePercent: number;
  isPassed: boolean;
  timeTakenMs?: number;
  /** True when the attempt was submitted after the time limit (it is still graded). */
  timedOut?: boolean;
  /** Pre/post tests never reveal which answers were right; `responses` is then empty. */
  answersHidden?: boolean;
  startedAt: string;
  submittedAt?: string;
  cognitiveBreakdown: Record<CognitiveLevel, { score: number; maxScore: number; accuracy: number }>;
  skillBreakdown: Record<string, { skillTitle: string; correct: number; total: number; accuracy: number }>;
  responses: Array<{
    id: string;
    questionId: string;
    prompt: string;
    studentAnswer: string;
    correctAnswer?: string;
    isCorrect: boolean;
    scoreAwarded: number;
    points: number;
    cognitiveLevel: CognitiveLevel;
    mistakeCategory?: string;
    feedbackGiven?: string;
  }>;
}

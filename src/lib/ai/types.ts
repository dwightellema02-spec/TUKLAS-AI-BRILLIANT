// Phase 7: AI Tutor Type Definitions

export type AITutorRoleType = "STUDENT" | "TUTOR" | "SYSTEM";

export type AITutorMessageType =
  | "QUESTION"
  | "HINT"
  | "GUIDING_QUESTION"
  | "EXPLANATION"
  | "EXAMPLE"
  | "FEEDBACK"
  | "CLARIFICATION"
  | "REDIRECT";

export type AITutorHelpLevel =
  | "LEVEL_1_HINT"
  | "LEVEL_2_HINT"
  | "GUIDING_QUESTION"
  | "CONCEPT_EXPLANATION"
  | "WORKED_EXAMPLE"
  | "FULL_EXPLANATION";

export interface StudentContextData {
  id: string;
  name: string;
  gradeLevel?: number | null;
}

export interface CurriculumContextData {
  subject: string;
  grade: number;
  term: number;
  unitTitle?: string;
  lessonTitle?: string;
}

export interface QuestionContextData {
  id: string;
  type: string;
  prompt: string;
  difficulty: string;
  choices?: Array<{ id: string; text: string }>;
  expectedAnswer?: string; // Used strictly internally for server-side pedagogical guidance
  correctFeedback?: string;
  incorrectFeedback?: string;
}

export interface AttemptHistoryItem {
  answer: string;
  isCorrect: boolean;
  attemptNumber: number;
  timeTakenMs?: number | null;
  submittedAt?: string;
}

export interface RecentMessageItem {
  role: "STUDENT" | "TUTOR";
  content: string;
  messageType?: string;
  createdAt?: string;
}

export interface AITutorGrounding {
  sources: import("../documents/types").GroundingSource[];
  inventory: import("../documents/grounding").ResourceInventoryItem[];
}

export interface AITutorContext {
  student: StudentContextData;
  curriculum: CurriculumContextData;
  lesson?: { id: string; title: string; description?: string | null };
  skill?: { id: string; title: string; description?: string | null };
  question?: QuestionContextData;
  studentAnswer?: any;
  previousAttempts: AttemptHistoryItem[];
  recentMessages: RecentMessageItem[];
  helpLevel: AITutorHelpLevel;
  studentQuery?: string;
  practiceSessionId?: string;
  mistakeInsight?: {
    category: string;
    possibleCause?: string | null;
    pattern?: string | null;
  };
  masteryInsight?: {
    status: string;
    accuracy: number;
    recentAccuracy: number;
    summary?: string;
  };
  /** Phase 22: retrieved lesson/document material and an honest inventory of attached resources. */
  grounding: AITutorGrounding;
}

export interface StructuredTutorResponse {
  responseType: AITutorMessageType;
  message: string;
  guidingQuestion?: string;
  hintLevel?: number;
  encouragement?: string;
  nextStep?: string;
  /** Source ids ([S1]..) the response relied on; validated against the retrieved set. */
  citedSourceIds?: string[];
}

export interface TutorAIRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Structured grounding, so non-LLM engines can use the same evidence as the prompt. */
  grounding?: AITutorGrounding;
  /** The student's latest message, for engines that cannot parse the prompt reliably. */
  studentQuery?: string;
}

export interface TutorAIResponseRaw {
  text: string;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  provider: string;
  model: string;
}

export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;
  generateTutorResponse(request: TutorAIRequest): Promise<TutorAIResponseRaw>;
}

export interface AITutorInteractParams {
  studentId: string;
  conversationId?: string;
  lessonId?: string;
  skillId?: string;
  questionId?: string;
  practiceSessionId?: string;
  studentQuery?: string;
  helpLevel?: AITutorHelpLevel;
  studentAnswer?: any;
}

export interface TutorMessageDTO {
  id: string;
  role: "STUDENT" | "TUTOR";
  content: string;
  messageType: AITutorMessageType;
  hintLevel?: number | null;
  guidingQuestion?: string | null;
  encouragement?: string | null;
  createdAt: string;
  /** Phase 22: sources the response is grounded in (verified server-side). */
  citations?: import("../documents/types").SourceCitation[];
}

export interface TutorAPIResponse {
  success: boolean;
  conversationId: string;
  message: TutorMessageDTO;
  providerInfo: {
    provider: string;
    model: string;
  };
  rateLimit?: {
    remaining: number;
    resetInSeconds: number;
  };
}

export interface TeacherAISettings {
  aiTutorEnabled: boolean;
  maxHintLevel: number;
  model: string;
  allowDirectStudentChat: boolean;
  provider: string;
}

// -------------------------------------------------------------
// PHASE 8: AI MISTAKE ANALYZER TYPES
// -------------------------------------------------------------

export type MistakeCategoryType =
  | "CALCULATION_ERROR"
  | "CONCEPTUAL_MISUNDERSTANDING"
  | "PREREQUISITE_GAP"
  | "APPLICATION_DIFFICULTY"
  | "SIGN_ERROR"
  | "PROCEDURAL_ERROR"
  | "READING_OR_INTERPRETATION_ERROR"
  | "INCONSISTENT_PERFORMANCE"
  | "POSSIBLE_CARELESS_ERROR"
  | "QUESTION_TYPE_DIFFICULTY"
  | "UNKNOWN";

export type AnalysisStatusType = "PENDING" | "COMPLETED" | "FAILED" | "OUTDATED";

export type AnalysisTriggerType =
  | "PRACTICE_COMPLETED"
  | "TEACHER_REQUESTED"
  | "N_NEW_ATTEMPTS"
  | "SKILL_THRESHOLD_REACHED";

export interface QuestionAttemptDetail {
  id: string;
  studentId: string;
  questionId: string;
  practiceSessionId?: string | null;
  skillId?: string | null;
  answer: string;
  isCorrect: boolean;
  attemptNumber: number;
  timeTakenMs?: number | null;
  hintUsed: boolean;
  submittedAt: Date | string;
  question: {
    id: string;
    type: string;
    prompt: string;
    difficulty: string;
    explanation?: string | null;
    questionData?: string | null;
    correctFeedback?: string | null;
    incorrectFeedback?: string | null;
  };
}

export interface DeterministicAnalysisResult {
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  accuracyPercentage: number;
  recentTrend: "IMPROVING" | "DECLINING" | "STABLE" | "INCONSISTENT";
  questionTypeDistribution: Record<
    string,
    { total: number; correct: number; incorrect: number }
  >;
  difficultyDistribution: Record<
    string,
    { total: number; correct: number; incorrect: number }
  >;
  hintUsageCount: number;
  retryCount: number;
  commonWrongAnswers: Array<{ answer: string; frequency: number }>;
  isolatedError: boolean;
  signErrorDetected: boolean;
  comparisonErrorDetected: boolean;
  prerequisiteGaps: Array<{
    prerequisiteSkillId: string;
    title: string;
    accuracy: number;
    totalAttempts: number;
  }>;
  strengthDetected: boolean;
}

export interface StructuredMistakeAnalysis {
  category: MistakeCategoryType;
  observation: string;
  pattern: string;
  possibleCause: string;
  confidence: number;
  recommendation: string;
  evidenceAttemptIds: string[];
}

export interface MistakeAnalysisEvidenceItem {
  attemptId: string;
  questionId: string;
  questionPrompt: string;
  questionType: string;
  difficulty: string;
  studentAnswer: string;
  isCorrect: boolean;
  attemptNumber: number;
  timeTakenMs?: number | null;
  submittedAt: string;
}

export interface MistakeAnalysisDTO {
  id: string;
  studentId: string;
  studentName?: string;
  skillId?: string | null;
  skillTitle?: string | null;
  lessonId?: string | null;
  lessonTitle?: string | null;
  practiceSessionId?: string | null;
  category: MistakeCategoryType;
  observation: string;
  pattern: string;
  possibleCause?: string | null;
  confidence: number;
  recommendation: string;
  evidenceSummary?: string | null;
  status: AnalysisStatusType;
  trigger: AnalysisTriggerType;
  analyzerVersion: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
  evidences: MistakeAnalysisEvidenceItem[];
}


-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'RESEARCHER');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('PDF', 'DOCUMENT', 'YOUTUBE', 'IMAGE', 'LINK', 'TEACHER_NOTE');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO', 'EXAMPLE', 'QUESTION', 'INTERACTIVE', 'HINT', 'CHECKPOINT', 'PRACTICE', 'SUMMARY');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'LEARNING', 'DEVELOPING', 'COMPLETED', 'PROFICIENT', 'MASTERED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'NUMERIC_INPUT', 'TEXT_INPUT', 'TRUE_FALSE', 'EQUATION', 'MATCHING', 'ORDERING', 'DRAG_DROP', 'GRAPH', 'GEOMETRY', 'INTERACTIVE_DIAGRAM', 'FILL_BLANK', 'MULTI_SELECT', 'FRACTION_INPUT', 'TABLE_INPUT');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "QuestionSource" AS ENUM ('TEACHER', 'SYSTEM', 'AI_GENERATED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "PracticeSessionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PracticeSetStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CognitiveLevel" AS ENUM ('KNOWLEDGE', 'PROCEDURAL', 'APPLICATION', 'HIGHER_ORDER');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('DIAGNOSTIC', 'FORMATIVE', 'SUMMATIVE', 'PRACTICE', 'PRE_TEST', 'POST_TEST');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AITutorRole" AS ENUM ('STUDENT', 'TUTOR', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AITutorMessageType" AS ENUM ('QUESTION', 'HINT', 'GUIDING_QUESTION', 'EXPLANATION', 'EXAMPLE', 'FEEDBACK', 'CLARIFICATION', 'REDIRECT');

-- CreateEnum
CREATE TYPE "AITutorHelpLevel" AS ENUM ('LEVEL_1_HINT', 'LEVEL_2_HINT', 'GUIDING_QUESTION', 'CONCEPT_EXPLANATION', 'WORKED_EXAMPLE', 'FULL_EXPLANATION');

-- CreateEnum
CREATE TYPE "MistakeCategory" AS ENUM ('CALCULATION_ERROR', 'CONCEPTUAL_MISUNDERSTANDING', 'PREREQUISITE_GAP', 'APPLICATION_DIFFICULTY', 'SIGN_ERROR', 'PROCEDURAL_ERROR', 'READING_OR_INTERPRETATION_ERROR', 'INCONSISTENT_PERFORMANCE', 'POSSIBLE_CARELESS_ERROR', 'QUESTION_TYPE_DIFFICULTY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'OUTDATED');

-- CreateEnum
CREATE TYPE "AnalysisTrigger" AS ENUM ('PRACTICE_COMPLETED', 'TEACHER_REQUESTED', 'N_NEW_ATTEMPTS', 'SKILL_THRESHOLD_REACHED');

-- CreateEnum
CREATE TYPE "AdaptiveDecisionType" AS ENUM ('REMEDIATE', 'REPEAT_LESSON', 'PRACTICE_EASIER', 'PRACTICE_SAME_DIFFICULTY', 'PRACTICE_HARDER', 'REVIEW_PREREQUISITE', 'CONTINUE', 'RETRY', 'TEACHER_REVIEW', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "AdaptiveSource" AS ENUM ('RULE_ENGINE', 'AI_ASSISTED', 'TEACHER_OVERRIDE');

-- CreateEnum
CREATE TYPE "AdaptiveRecommendationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISMISSED', 'EXPIRED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "AdaptiveConfidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RecommendedActivityType" AS ENUM ('PRACTICE_SET', 'LESSON_REVIEW', 'PREREQUISITE_LESSON', 'AI_TUTOR_SESSION', 'TEACHER_CONSULTATION', 'CONTINUE_PATH');

-- CreateEnum
CREATE TYPE "MasteryLevel" AS ENUM ('NOT_STARTED', 'LEARNING', 'DEVELOPING', 'PROFICIENT', 'MASTERED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "gradeLevel" INTEGER,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Term" (
    "id" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "termNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Term_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "authorId" TEXT,
    "sequenceOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "learningObjectives" TEXT[],
    "status" "LessonStatus" NOT NULL DEFAULT 'DRAFT',
    "videoUrl" TEXT,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 15,
    "prerequisiteLessonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonResource" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "youtubeId" TEXT,
    "provider" TEXT DEFAULT 'YOUTUBE',
    "channelName" TEXT,
    "thumbnailUrl" TEXT,
    "description" TEXT,
    "duration" TEXT,
    "status" TEXT DEFAULT 'APPROVED',
    "addedBy" TEXT,
    "notes" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "storagePath" TEXT,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "extractionStatus" TEXT,
    "extractionError" TEXT,
    "pageCount" INTEGER,
    "charCount" INTEGER,
    "contentHash" TEXT,

    CONSTRAINT "LessonResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceChunk" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "sectionLabel" TEXT NOT NULL,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "isAnswerKey" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ResourceChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonContentBlock" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" "BlockType" NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonContentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSkill" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sequenceOrder" INTEGER NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPrerequisite" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "prerequisiteSkillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillPrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT,
    "skillId" TEXT,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "progressPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "understandingScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "accuracyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "applicationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "compositeScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "currentSectionIndex" INTEGER NOT NULL DEFAULT 0,
    "completedBlockIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LessonSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckpointAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckpointAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT,
    "skillId" TEXT,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "explanation" TEXT,
    "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "QuestionSource" NOT NULL DEFAULT 'TEACHER',
    "createdById" TEXT,
    "reviewedById" TEXT,
    "questionData" TEXT NOT NULL,
    "metadata" TEXT,
    "correctFeedback" TEXT,
    "incorrectFeedback" TEXT,
    "allowRetry" BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cognitiveLevel" "CognitiveLevel" DEFAULT 'PROCEDURAL',

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "lessonId" TEXT,
    "skillId" TEXT,
    "status" "PracticeSetStatus" NOT NULL DEFAULT 'DRAFT',
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSetQuestion" (
    "id" TEXT NOT NULL,
    "practiceSetId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PracticeSetQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "practiceSetId" TEXT,
    "lessonId" TEXT,
    "skillId" TEXT,
    "status" "PracticeSessionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeSessionQuestion" (
    "id" TEXT NOT NULL,
    "practiceSessionId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PracticeSessionQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionAttempt" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "practiceSessionId" TEXT,
    "skillId" TEXT,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "timeTakenMs" INTEGER,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITutorConversation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonId" TEXT,
    "skillId" TEXT,
    "questionId" TEXT,
    "practiceSessionId" TEXT,
    "stateJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AITutorConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AITutorMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "AITutorRole" NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" "AITutorMessageType" NOT NULL DEFAULT 'HINT',
    "hintLevel" INTEGER,
    "guidingQuestion" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AITutorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MistakeAnalysis" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT,
    "lessonId" TEXT,
    "practiceSessionId" TEXT,
    "category" "MistakeCategory" NOT NULL DEFAULT 'UNKNOWN',
    "observation" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "possibleCause" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "recommendation" TEXT NOT NULL,
    "evidenceSummary" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'COMPLETED',
    "trigger" "AnalysisTrigger" NOT NULL DEFAULT 'PRACTICE_COMPLETED',
    "analyzerVersion" TEXT NOT NULL DEFAULT '1.0',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MistakeAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MistakeAnalysisEvidence" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION DEFAULT 1.0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MistakeAnalysisEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRecommendation" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT,
    "lessonId" TEXT,
    "decisionType" "AdaptiveDecisionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceSummary" TEXT,
    "confidence" "AdaptiveConfidence" NOT NULL DEFAULT 'MEDIUM',
    "recommendedActivityType" "RecommendedActivityType" NOT NULL,
    "recommendedActivityId" TEXT,
    "source" "AdaptiveSource" NOT NULL DEFAULT 'RULE_ENGINE',
    "status" "AdaptiveRecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetDifficulty" "QuestionDifficulty",
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AdaptiveRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveRecommendationOverride" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "originalDecision" "AdaptiveDecisionType" NOT NULL,
    "overrideDecision" "AdaptiveDecisionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveRecommendationOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillMastery" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "status" "MasteryLevel" NOT NULL DEFAULT 'NOT_STARTED',
    "evidenceSummary" TEXT,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "recentAccuracy" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "consistencyScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "applicationScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "masteryVersion" TEXT NOT NULL DEFAULT 'MASTERY_V1',
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillMastery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillMasteryHistory" (
    "id" TEXT NOT NULL,
    "skillMasteryId" TEXT NOT NULL,
    "previousStatus" "MasteryLevel",
    "newStatus" "MasteryLevel" NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceSummary" TEXT,
    "masteryVersion" TEXT NOT NULL DEFAULT 'MASTERY_V1',
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillMasteryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Classroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gradeLevel" INTEGER NOT NULL DEFAULT 7,
    "subject" TEXT NOT NULL DEFAULT 'Mathematics',
    "schoolYear" TEXT NOT NULL DEFAULT '2026-2027',
    "teacherId" TEXT NOT NULL,
    "joinCode" TEXT,
    "joinCodeActive" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonUnlock" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomEnrollment" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'TEACHER',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassroomEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "classroomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "lessonId" TEXT,
    "practiceSetId" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssessmentType" NOT NULL DEFAULT 'FORMATIVE',
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "timeLimitMinutes" INTEGER,
    "passingScorePercent" DOUBLE PRECISION NOT NULL DEFAULT 70.0,
    "authorId" TEXT NOT NULL,
    "lessonId" TEXT,
    "unitId" TEXT,
    "gradeLevel" INTEGER NOT NULL DEFAULT 7,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
    "showFeedbackImmediately" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentItem" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sequenceOrder" INTEGER NOT NULL DEFAULT 1,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "cognitiveLevel" "CognitiveLevel" DEFAULT 'PROCEDURAL',

    CONSTRAINT "AssessmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAssignment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "classroomId" TEXT,
    "studentId" TEXT,
    "dueDate" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentAttempt" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "assessmentType" "AssessmentType" NOT NULL DEFAULT 'FORMATIVE',
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "scorePercent" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "isPassed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "timeTakenMs" INTEGER,
    "metadata" TEXT,

    CONSTRAINT "AssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentItemResponse" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "assessmentItemId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "studentAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "scoreAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "timeTakenMs" INTEGER,
    "hintUsed" BOOLEAN NOT NULL DEFAULT false,
    "mistakeCategory" "MistakeCategory",
    "cognitiveLevel" "CognitiveLevel" DEFAULT 'PROCEDURAL',
    "feedbackGiven" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentItemResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchMetricRecord" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classroomId" TEXT,
    "skillId" TEXT,
    "lessonId" TEXT,
    "assessmentId" TEXT,
    "assessmentType" "AssessmentType",
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "level" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "calculationVersion" TEXT NOT NULL DEFAULT 'RESEARCH_V1',
    "evidenceSummary" TEXT,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchMetricRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "detail" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_subjectId_level_key" ON "Grade"("subjectId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Term_gradeId_termNumber_key" ON "Term"("gradeId", "termNumber");

-- CreateIndex
CREATE INDEX "Unit_termId_sequenceOrder_idx" ON "Unit"("termId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "Lesson_unitId_sequenceOrder_idx" ON "Lesson"("unitId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "Lesson_status_idx" ON "Lesson"("status");

-- CreateIndex
CREATE INDEX "LessonResource_lessonId_sequenceOrder_idx" ON "LessonResource"("lessonId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "ResourceChunk_lessonId_idx" ON "ResourceChunk"("lessonId");

-- CreateIndex
CREATE INDEX "ResourceChunk_resourceId_ordinal_idx" ON "ResourceChunk"("resourceId", "ordinal");

-- CreateIndex
CREATE INDEX "LessonContentBlock_lessonId_sequenceOrder_idx" ON "LessonContentBlock"("lessonId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LessonSkill_lessonId_skillId_key" ON "LessonSkill"("lessonId", "skillId");

-- CreateIndex
CREATE INDEX "Competency_unitId_sequenceOrder_idx" ON "Competency"("unitId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "Skill_competencyId_sequenceOrder_idx" ON "Skill"("competencyId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPrerequisite_skillId_prerequisiteSkillId_key" ON "SkillPrerequisite"("skillId", "prerequisiteSkillId");

-- CreateIndex
CREATE INDEX "StudentProgress_userId_status_idx" ON "StudentProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProgress_userId_skillId_key" ON "StudentProgress"("userId", "skillId");

-- CreateIndex
CREATE INDEX "LessonSession_userId_lastActivityAt_idx" ON "LessonSession"("userId", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "LessonSession_userId_lessonId_key" ON "LessonSession"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "CheckpointAttempt_userId_lessonId_blockId_idx" ON "CheckpointAttempt"("userId", "lessonId", "blockId");

-- CreateIndex
CREATE INDEX "Question_skillId_status_idx" ON "Question"("skillId", "status");

-- CreateIndex
CREATE INDEX "Question_lessonId_status_idx" ON "Question"("lessonId", "status");

-- CreateIndex
CREATE INDEX "Question_difficulty_idx" ON "Question"("difficulty");

-- CreateIndex
CREATE INDEX "Question_type_idx" ON "Question"("type");

-- CreateIndex
CREATE INDEX "Question_status_idx" ON "Question"("status");

-- CreateIndex
CREATE INDEX "PracticeSet_lessonId_status_idx" ON "PracticeSet"("lessonId", "status");

-- CreateIndex
CREATE INDEX "PracticeSet_skillId_status_idx" ON "PracticeSet"("skillId", "status");

-- CreateIndex
CREATE INDEX "PracticeSetQuestion_practiceSetId_order_idx" ON "PracticeSetQuestion"("practiceSetId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeSetQuestion_practiceSetId_questionId_key" ON "PracticeSetQuestion"("practiceSetId", "questionId");

-- CreateIndex
CREATE INDEX "PracticeSession_studentId_status_idx" ON "PracticeSession"("studentId", "status");

-- CreateIndex
CREATE INDEX "PracticeSession_practiceSetId_idx" ON "PracticeSession"("practiceSetId");

-- CreateIndex
CREATE INDEX "PracticeSessionQuestion_practiceSessionId_order_idx" ON "PracticeSessionQuestion"("practiceSessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeSessionQuestion_practiceSessionId_questionId_key" ON "PracticeSessionQuestion"("practiceSessionId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_studentId_questionId_idx" ON "QuestionAttempt"("studentId", "questionId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_practiceSessionId_idx" ON "QuestionAttempt"("practiceSessionId");

-- CreateIndex
CREATE INDEX "QuestionAttempt_studentId_submittedAt_idx" ON "QuestionAttempt"("studentId", "submittedAt");

-- CreateIndex
CREATE INDEX "AITutorConversation_studentId_lessonId_idx" ON "AITutorConversation"("studentId", "lessonId");

-- CreateIndex
CREATE INDEX "AITutorConversation_studentId_questionId_idx" ON "AITutorConversation"("studentId", "questionId");

-- CreateIndex
CREATE INDEX "AITutorConversation_practiceSessionId_idx" ON "AITutorConversation"("practiceSessionId");

-- CreateIndex
CREATE INDEX "AITutorConversation_studentId_createdAt_idx" ON "AITutorConversation"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "AITutorMessage_conversationId_createdAt_idx" ON "AITutorMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MistakeAnalysis_studentId_skillId_idx" ON "MistakeAnalysis"("studentId", "skillId");

-- CreateIndex
CREATE INDEX "MistakeAnalysis_studentId_createdAt_idx" ON "MistakeAnalysis"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "MistakeAnalysis_category_idx" ON "MistakeAnalysis"("category");

-- CreateIndex
CREATE INDEX "MistakeAnalysis_status_idx" ON "MistakeAnalysis"("status");

-- CreateIndex
CREATE INDEX "MistakeAnalysisEvidence_analysisId_idx" ON "MistakeAnalysisEvidence"("analysisId");

-- CreateIndex
CREATE INDEX "MistakeAnalysisEvidence_attemptId_idx" ON "MistakeAnalysisEvidence"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "MistakeAnalysisEvidence_analysisId_attemptId_key" ON "MistakeAnalysisEvidence"("analysisId", "attemptId");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendation_studentId_status_idx" ON "AdaptiveRecommendation"("studentId", "status");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendation_studentId_skillId_idx" ON "AdaptiveRecommendation"("studentId", "skillId");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendation_decisionType_idx" ON "AdaptiveRecommendation"("decisionType");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendation_createdAt_idx" ON "AdaptiveRecommendation"("createdAt");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendationOverride_recommendationId_idx" ON "AdaptiveRecommendationOverride"("recommendationId");

-- CreateIndex
CREATE INDEX "AdaptiveRecommendationOverride_teacherId_idx" ON "AdaptiveRecommendationOverride"("teacherId");

-- CreateIndex
CREATE INDEX "SkillMastery_studentId_status_idx" ON "SkillMastery"("studentId", "status");

-- CreateIndex
CREATE INDEX "SkillMastery_skillId_status_idx" ON "SkillMastery"("skillId", "status");

-- CreateIndex
CREATE INDEX "SkillMastery_lastEvaluatedAt_idx" ON "SkillMastery"("lastEvaluatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillMastery_studentId_skillId_key" ON "SkillMastery"("studentId", "skillId");

-- CreateIndex
CREATE INDEX "SkillMasteryHistory_skillMasteryId_idx" ON "SkillMasteryHistory"("skillMasteryId");

-- CreateIndex
CREATE INDEX "SkillMasteryHistory_createdAt_idx" ON "SkillMasteryHistory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Classroom_joinCode_key" ON "Classroom"("joinCode");

-- CreateIndex
CREATE INDEX "Classroom_teacherId_idx" ON "Classroom"("teacherId");

-- CreateIndex
CREATE INDEX "Classroom_gradeLevel_idx" ON "Classroom"("gradeLevel");

-- CreateIndex
CREATE INDEX "LessonUnlock_classroomId_idx" ON "LessonUnlock"("classroomId");

-- CreateIndex
CREATE INDEX "LessonUnlock_studentId_idx" ON "LessonUnlock"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonUnlock_classroomId_lessonId_studentId_key" ON "LessonUnlock"("classroomId", "lessonId", "studentId");

-- CreateIndex
CREATE INDEX "ClassroomEnrollment_classroomId_idx" ON "ClassroomEnrollment"("classroomId");

-- CreateIndex
CREATE INDEX "ClassroomEnrollment_studentId_idx" ON "ClassroomEnrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomEnrollment_classroomId_studentId_key" ON "ClassroomEnrollment"("classroomId", "studentId");

-- CreateIndex
CREATE INDEX "Assignment_classroomId_idx" ON "Assignment"("classroomId");

-- CreateIndex
CREATE INDEX "Assignment_lessonId_idx" ON "Assignment"("lessonId");

-- CreateIndex
CREATE INDEX "Assignment_practiceSetId_idx" ON "Assignment"("practiceSetId");

-- CreateIndex
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");

-- CreateIndex
CREATE INDEX "Assessment_authorId_idx" ON "Assessment"("authorId");

-- CreateIndex
CREATE INDEX "Assessment_lessonId_idx" ON "Assessment"("lessonId");

-- CreateIndex
CREATE INDEX "Assessment_type_idx" ON "Assessment"("type");

-- CreateIndex
CREATE INDEX "Assessment_status_idx" ON "Assessment"("status");

-- CreateIndex
CREATE INDEX "Assessment_gradeLevel_idx" ON "Assessment"("gradeLevel");

-- CreateIndex
CREATE INDEX "AssessmentItem_assessmentId_sequenceOrder_idx" ON "AssessmentItem"("assessmentId", "sequenceOrder");

-- CreateIndex
CREATE INDEX "AssessmentItem_questionId_idx" ON "AssessmentItem"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentItem_assessmentId_questionId_key" ON "AssessmentItem"("assessmentId", "questionId");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_assessmentId_idx" ON "AssessmentAssignment"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_classroomId_idx" ON "AssessmentAssignment"("classroomId");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_studentId_idx" ON "AssessmentAssignment"("studentId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_assessmentId_idx" ON "AssessmentAttempt"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_studentId_idx" ON "AssessmentAttempt"("studentId");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_assessmentType_idx" ON "AssessmentAttempt"("assessmentType");

-- CreateIndex
CREATE INDEX "AssessmentAttempt_submittedAt_idx" ON "AssessmentAttempt"("submittedAt");

-- CreateIndex
CREATE INDEX "AssessmentItemResponse_attemptId_idx" ON "AssessmentItemResponse"("attemptId");

-- CreateIndex
CREATE INDEX "AssessmentItemResponse_assessmentItemId_idx" ON "AssessmentItemResponse"("assessmentItemId");

-- CreateIndex
CREATE INDEX "AssessmentItemResponse_questionId_idx" ON "AssessmentItemResponse"("questionId");

-- CreateIndex
CREATE INDEX "ResearchMetricRecord_studentId_metric_idx" ON "ResearchMetricRecord"("studentId", "metric");

-- CreateIndex
CREATE INDEX "ResearchMetricRecord_classroomId_idx" ON "ResearchMetricRecord"("classroomId");

-- CreateIndex
CREATE INDEX "ResearchMetricRecord_skillId_idx" ON "ResearchMetricRecord"("skillId");

-- CreateIndex
CREATE INDEX "ResearchMetricRecord_lessonId_idx" ON "ResearchMetricRecord"("lessonId");

-- CreateIndex
CREATE INDEX "ResearchMetricRecord_calculatedAt_idx" ON "ResearchMetricRecord"("calculatedAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Term" ADD CONSTRAINT "Term_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_prerequisiteLessonId_fkey" FOREIGN KEY ("prerequisiteLessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonResource" ADD CONSTRAINT "LessonResource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceChunk" ADD CONSTRAINT "ResourceChunk_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "LessonResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonContentBlock" ADD CONSTRAINT "LessonContentBlock_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSkill" ADD CONSTRAINT "LessonSkill_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSkill" ADD CONSTRAINT "LessonSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPrerequisite" ADD CONSTRAINT "SkillPrerequisite_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPrerequisite" ADD CONSTRAINT "SkillPrerequisite_prerequisiteSkillId_fkey" FOREIGN KEY ("prerequisiteSkillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgress" ADD CONSTRAINT "StudentProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgress" ADD CONSTRAINT "StudentProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProgress" ADD CONSTRAINT "StudentProgress_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSession" ADD CONSTRAINT "LessonSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonSession" ADD CONSTRAINT "LessonSession_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointAttempt" ADD CONSTRAINT "CheckpointAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointAttempt" ADD CONSTRAINT "CheckpointAttempt_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSet" ADD CONSTRAINT "PracticeSet_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSet" ADD CONSTRAINT "PracticeSet_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSet" ADD CONSTRAINT "PracticeSet_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSetQuestion" ADD CONSTRAINT "PracticeSetQuestion_practiceSetId_fkey" FOREIGN KEY ("practiceSetId") REFERENCES "PracticeSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSetQuestion" ADD CONSTRAINT "PracticeSetQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSession" ADD CONSTRAINT "PracticeSession_practiceSetId_fkey" FOREIGN KEY ("practiceSetId") REFERENCES "PracticeSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSessionQuestion" ADD CONSTRAINT "PracticeSessionQuestion_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeSessionQuestion" ADD CONSTRAINT "PracticeSessionQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "PracticeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITutorConversation" ADD CONSTRAINT "AITutorConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITutorConversation" ADD CONSTRAINT "AITutorConversation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITutorConversation" ADD CONSTRAINT "AITutorConversation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITutorConversation" ADD CONSTRAINT "AITutorConversation_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITutorConversation" ADD CONSTRAINT "AITutorConversation_practiceSessionId_fkey" FOREIGN KEY ("practiceSessionId") REFERENCES "PracticeSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AITutorMessage" ADD CONSTRAINT "AITutorMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AITutorConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistakeAnalysis" ADD CONSTRAINT "MistakeAnalysis_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistakeAnalysis" ADD CONSTRAINT "MistakeAnalysis_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistakeAnalysis" ADD CONSTRAINT "MistakeAnalysis_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistakeAnalysisEvidence" ADD CONSTRAINT "MistakeAnalysisEvidence_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "MistakeAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistakeAnalysisEvidence" ADD CONSTRAINT "MistakeAnalysisEvidence_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuestionAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRecommendation" ADD CONSTRAINT "AdaptiveRecommendation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRecommendation" ADD CONSTRAINT "AdaptiveRecommendation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRecommendation" ADD CONSTRAINT "AdaptiveRecommendation_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRecommendationOverride" ADD CONSTRAINT "AdaptiveRecommendationOverride_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "AdaptiveRecommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptiveRecommendationOverride" ADD CONSTRAINT "AdaptiveRecommendationOverride_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMastery" ADD CONSTRAINT "SkillMastery_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMastery" ADD CONSTRAINT "SkillMastery_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillMasteryHistory" ADD CONSTRAINT "SkillMasteryHistory_skillMasteryId_fkey" FOREIGN KEY ("skillMasteryId") REFERENCES "SkillMastery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonUnlock" ADD CONSTRAINT "LessonUnlock_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomEnrollment" ADD CONSTRAINT "ClassroomEnrollment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomEnrollment" ADD CONSTRAINT "ClassroomEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItem" ADD CONSTRAINT "AssessmentItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItemResponse" ADD CONSTRAINT "AssessmentItemResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentItemResponse" ADD CONSTRAINT "AssessmentItemResponse_assessmentItemId_fkey" FOREIGN KEY ("assessmentItemId") REFERENCES "AssessmentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchMetricRecord" ADD CONSTRAINT "ResearchMetricRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


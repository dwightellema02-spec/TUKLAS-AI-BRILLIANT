/**
 * Tuklas AI - Database Access Utility
 * Singleton Prisma Client with Phase 4 Learning Path & Prerequisite Engine and resilient sandbox fallback.
 */

import { isGradableType, parseChoiceBlock } from "./lesson/block-grading";

/** Thrown when a student tries to complete a lesson that still has unanswered questions. */
export class LessonIncompleteError extends Error {
  constructor(public missingBlockIds: string[]) {
    super(`Answer ${missingBlockIds.length} remaining question${missingBlockIds.length === 1 ? "" : "s"} correctly to complete this lesson.`);
    this.name = "LessonIncompleteError";
  }
}
import fs from "fs";
import path from "path";
import {
  PrismaClient,
  UserRole,
  LessonStatus,
  ProgressStatus,
  ResourceType,
  BlockType,
  QuestionType,
  QuestionStatus,
  QuestionDifficulty,
  QuestionSource,
  PracticeSessionStatus,
  PracticeSetStatus,
} from "@prisma/client";
import { QuestionValidator } from "./question-validator";

// Global singleton declaration to avoid multiple PrismaClient instances in development/HMR
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isPostgresUrl = (url: string | undefined): boolean => {
  if (!url) return false;
  return (
    url.startsWith("postgresql://") ||
    url.startsWith("postgres://") ||
    url.startsWith("prisma://")
  );
};

export const hasValidDatabaseUrl = isPostgresUrl(process.env.DATABASE_URL);

/**
 * Accounts are NEVER served from the in-memory demo store when a real database is configured.
 * (Previously a missing DB row fell through to the demo users, whose password is public, so a production
 * deployment accepted demo-account logins.)
 */
export const useInMemoryAccounts = !hasValidDatabaseUrl;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// -------------------------------------------------------------
// DATA INTERFACES
// -------------------------------------------------------------

export interface LessonResourceItem {
  id: string;
  lessonId: string;
  type: ResourceType;
  title: string;
  url?: string;
  youtubeId?: string;
  provider?: string;
  channelName?: string;
  thumbnailUrl?: string;
  description?: string;
  duration?: string;
  status?: string;
  addedBy?: string;
  notes?: string;
  fileName?: string;
  fileSize?: number;
  storagePath?: string;
  // Phase 22: document intelligence metadata
  extractionStatus?: string;
  extractionError?: string;
  pageCount?: number;
  charCount?: number;
  contentHash?: string;
  sequenceOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonContentBlockItem {
  id: string;
  lessonId: string;
  type: BlockType;
  sequenceOrder: number;
  title?: string;
  content: string;
  metadata?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonItem {
  id: string;
  unitId: string;
  authorId?: string;
  sequenceOrder: number;
  title: string;
  description?: string;
  learningObjectives: string[];
  status: LessonStatus;
  videoUrl?: string;
  estimatedMinutes: number;
  prerequisiteLessonId?: string;
  createdAt: Date;
  updatedAt: Date;
  resources: LessonResourceItem[];
  contentBlocks: LessonContentBlockItem[];
  skillIds: string[];
}

export interface SkillItem {
  id: string;
  title: string;
  description: string;
  sequenceOrder: number;
  difficulty: number;
  competencyId: string;
  prerequisiteIds: string[];
}

export interface StudentProgressItem {
  id: string;
  userId: string;
  lessonId?: string;
  skillId?: string;
  status: ProgressStatus;
  progressPercentage: number;
  startedAt?: Date;
  completedAt?: Date;
  understandingScore: number;
  accuracyScore: number;
  applicationScore: number;
  consistencyScore: number;
  compositeScore: number;
  attemptCount: number;
  lastActivity: Date;
}

export interface LessonSessionItem {
  id: string;
  userId: string;
  lessonId: string;
  currentSectionIndex: number;
  completedBlockIds: string[];
  startedAt: Date;
  lastActivityAt: Date;
  completedAt?: Date;
}

export interface CheckpointAttemptItem {
  id: string;
  userId: string;
  lessonId: string;
  blockId: string;
  attempt: number;
  answer: string;
  isCorrect: boolean;
  feedback?: string;
  createdAt: Date;
}

export interface QuestionItem {
  id: string;
  lessonId?: string | null;
  skillId?: string | null;
  type: QuestionType;
  prompt: string;
  explanation?: string | null;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  source: QuestionSource;
  createdById?: string | null;
  reviewedById?: string | null;
  questionData: string;
  metadata?: string | null;
  correctFeedback?: string | null;
  incorrectFeedback?: string | null;
  allowRetry: boolean;
  maxAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PracticeSetItem {
  id: string;
  title: string;
  description?: string | null;
  lessonId?: string | null;
  skillId?: string | null;
  status: PracticeSetStatus;
  questionCount: number;
  createdById?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PracticeSetQuestionItem {
  id: string;
  practiceSetId: string;
  questionId: string;
  order: number;
}

export interface PracticeSessionItem {
  id: string;
  studentId: string;
  practiceSetId?: string | null;
  lessonId?: string | null;
  skillId?: string | null;
  status: PracticeSessionStatus;
  startedAt: Date;
  completedAt?: Date | null;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PracticeSessionQuestionItem {
  id: string;
  practiceSessionId: string;
  questionId: string;
  order: number;
  completedAt?: Date | null;
}

export interface QuestionAttemptItem {
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
  submittedAt: Date;
}

export interface SeedDataStore {
  users: Array<{
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    role: UserRole;
    gradeLevel?: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  curriculum: {
    subject: {
      id: string;
      code: string;
      name: string;
      description: string;
    };
    grade: {
      id: string;
      level: number;
      name: string;
    };
    term: {
      id: string;
      termNumber: number;
      name: string;
    };
    unit: {
      id: string;
      title: string;
      sequenceOrder: number;
      description: string;
    };
    lessons: LessonItem[];
    competencies: Array<{
      id: string;
      code: string;
      statement: string;
      sequenceOrder: number;
    }>;
    skills: SkillItem[];
  };
  progress: StudentProgressItem[];
  sessions: LessonSessionItem[];
  checkpointAttempts: CheckpointAttemptItem[];
  questions: QuestionItem[];
  practiceSets: PracticeSetItem[];
  practiceSetQuestions: PracticeSetQuestionItem[];
  practiceSessions: PracticeSessionItem[];
  practiceSessionQuestions: PracticeSessionQuestionItem[];
  questionAttempts: QuestionAttemptItem[];
  aiConversations: any[];
  aiMessages: any[];
  teacherAISettings: any;
  mistakeAnalyses: any[];
  mistakeAnalysisEvidences: any[];
  adaptiveRecommendations: any[];
  adaptiveRecommendationOverrides: any[];
  skillMasteries: any[];
  skillMasteryHistory: any[];
  classrooms: any[];
  classroomEnrollments: any[];
  assignments: any[];
  /** Phase 22: extracted document/note chunks (in-memory fallback mirror of the ResourceChunk table). */
  resourceChunks: Array<import("./documents/types").StoredChunk>;
}

// -------------------------------------------------------------
// SAMPLE / DEMO SEED DATA (Grade 7 Term 1 Numbers and Algebraic Expressions)
// -------------------------------------------------------------

export const fallbackStore: SeedDataStore = {
  users: [
    {
      id: "usr_student_01",
      email: "student@tuklas.ai",
      name: "Juan de la Cruz",
      passwordHash: "$2b$10$SGOGNZL00CExpIy4kU49/O1J6yQa3.ClMAzZFW4vy5Ix/NXleijli",
      role: "STUDENT",
      gradeLevel: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "usr_student_02",
      email: "maria.clara@tuklas.ai",
      name: "Maria Clara de los Santos",
      passwordHash: "$2b$10$SGOGNZL00CExpIy4kU49/O1J6yQa3.ClMAzZFW4vy5Ix/NXleijli",
      role: "STUDENT",
      gradeLevel: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "usr_student_03",
      email: "crisostomo.ibarra@tuklas.ai",
      name: "Crisostomo Ibarra",
      passwordHash: "$2b$10$SGOGNZL00CExpIy4kU49/O1J6yQa3.ClMAzZFW4vy5Ix/NXleijli",
      role: "STUDENT",
      gradeLevel: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "usr_student_04",
      email: "basilio.magalang@tuklas.ai",
      name: "Basilio Magalang",
      passwordHash: "$2b$10$SGOGNZL00CExpIy4kU49/O1J6yQa3.ClMAzZFW4vy5Ix/NXleijli",
      role: "STUDENT",
      gradeLevel: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "usr_student_05",
      email: "elias.salvi@tuklas.ai",
      name: "Elias Salvi",
      passwordHash: "$2b$10$SGOGNZL00CExpIy4kU49/O1J6yQa3.ClMAzZFW4vy5Ix/NXleijli",
      role: "STUDENT",
      gradeLevel: 7,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "usr_teacher_01",
      email: "teacher@tuklas.ai",
      name: "Maria Santos (Teacher)",
      passwordHash: "$2b$10$SGOGNZL00CExpIy4kU49/O1J6yQa3.ClMAzZFW4vy5Ix/NXleijli",
      role: "TEACHER",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "usr_admin_01",
      email: "admin@tuklas.ai",
      name: "Tuklas Administrator",
      passwordHash: "$2b$10$SGOGNZL00CExpIy4kU49/O1J6yQa3.ClMAzZFW4vy5Ix/NXleijli",
      role: "ADMIN",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  curriculum: {
    subject: {
      id: "subj_math_g7",
      code: "MATH",
      name: "Mathematics",
      description: "Department of Education MATATAG Mathematics Curriculum",
    },
    grade: {
      id: "grd_07",
      level: 7,
      name: "Grade 7",
    },
    term: {
      id: "trm_01",
      termNumber: 1,
      name: "Term 1",
    },
    unit: {
      id: "unt_01",
      title: "Numbers and Algebraic Expressions",
      sequenceOrder: 1,
      description: "Foundational number concepts, integers, and operations for Grade 7 MATATAG.",
    },
    lessons: [
      // 1. Understanding Integers
      {
        id: "lsn_01",
        unitId: "unt_01",
        authorId: "usr_teacher_01",
        sequenceOrder: 1,
        title: "Understanding Integers",
        description: "An intuitive introduction to positive and negative integers, real-world models, and number line representations.",
        status: "PUBLISHED",
        learningObjectives: [
          "Define positive and negative integers in real-life contexts",
          "Compare and arrange integers on a horizontal number line",
          "Identify opposite values and absolute magnitude",
        ],
        estimatedMinutes: 20,
        createdAt: new Date("2026-09-01"),
        updatedAt: new Date(),
        skillIds: ["skl_01", "skl_02", "skl_03"],
        resources: [
          {
            id: "res_yt_01",
            lessonId: "lsn_01",
            type: "YOUTUBE",
            title: "Mathisipan: Introduction to Integers and Real-World Applications",
            url: "https://www.youtube.com/watch?v=oxkHZZpP2oQ",
            youtubeId: "oxkHZZpP2oQ",
            notes: "Curated learning video aligned with DepEd Grade 7 standards.",
            sequenceOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "res_note_01",
            lessonId: "lsn_01",
            type: "TEACHER_NOTE",
            title: "Pedagogical Note: Concrete to Abstract",
            notes:
              "Instructional recommendation: Introduce physical analogies (temperatures below zero, underwater depths, elevator basements) before drawing the abstract numerical axis.",
            sequenceOrder: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "res_doc_01",
            lessonId: "lsn_01",
            type: "PDF",
            title: "DepEd MATATAG Integers Learner Activity Sheet.pdf",
            fileName: "integers-activity-sheet.pdf",
            fileSize: 1425000,
            storagePath: "/storage/curriculum/g7/integers-activity-sheet.pdf",
            sequenceOrder: 3,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        contentBlocks: [
          {
            id: "blk_01",
            lessonId: "lsn_01",
            type: "TEXT",
            sequenceOrder: 1,
            title: "1. Introduction to Integers",
            content:
              "Welcome to Grade 7 Mathematics! In everyday life, we frequently count positive quantities like money earned, degrees above zero, or meters above sea level. But how do we represent loss, freezing temperatures, or depths below sea level?\n\nTo represent these opposite quantities, mathematicians developed the system of **integers**.",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_02",
            lessonId: "lsn_01",
            type: "TEXT",
            sequenceOrder: 2,
            title: "2. What are Integers?",
            content:
              "An integer is any whole number that can be positive, negative, or zero.\n\n$$\\mathbb{Z} = \\{ \\dots, -3, -2, -1, 0, 1, 2, 3, \\dots \\}$$\n\n• **Positive Integers** ($+1, +2, +3, \\dots$): Represent quantities greater than zero.\n• **Zero** ($0$): Neutral reference origin (neither positive nor negative).\n• **Negative Integers** ($-1, -2, -3, \\dots$): Represent quantities less than zero.\n\nNotice that fractions and decimals (such as $\\frac{1}{2}$ or $-2.75$) are **not** integers.",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_03",
            lessonId: "lsn_01",
            type: "VIDEO",
            sequenceOrder: 3,
            title: "3. Curated Concept Video",
            content: "Watch this curated video explanation illustrating integers in everyday Philippine contexts.",
            metadata: JSON.stringify({
              youtubeId: "oxkHZZpP2oQ",
              url: "https://www.youtube.com/watch?v=oxkHZZpP2oQ",
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_04",
            lessonId: "lsn_01",
            type: "EXAMPLE",
            sequenceOrder: 4,
            title: "4. Worked Example: Representing -3 on a Number Line",
            content:
              "Problem: Graph and describe the position of -3 on a horizontal number line.\n\nStep 1: Locate 0 (the origin) at the center of the number line.\nStep 2: Recognize that negative integers lie to the LEFT of zero.\nStep 3: Move 3 units to the left of 0 and plot the point.\n\nAnswer: The point -3 is plotted exactly 3 units to the left of 0. Its distance from zero is 3, which means $|-3| = 3$.",
            metadata: JSON.stringify({
              problem: "Graph and describe the position of $-3$ on a horizontal number line.",
              steps: [
                "Locate 0 (the origin) at the center of the coordinate axis.",
                "Identify that negative integers lie to the LEFT of zero.",
                "Count 3 units to the left of 0 and plot the point.",
              ],
              answer: "The point $-3$ lies 3 units to the left of $0$. Its distance from zero is 3 ($|-3| = 3$).",
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_05",
            lessonId: "lsn_01",
            type: "CHECKPOINT",
            sequenceOrder: 5,
            title: "5. Concept Checkpoint: Comparing Integers",
            content: "Which number is greater?",
            metadata: JSON.stringify({
              question: "Which number is greater?",
              options: ["-5", "-2", "-8"],
              correctAnswer: "-2",
              explanation: "On a horizontal number line, numbers farther to the right are greater. -2 is to the right of -5 and -8, so -2 > -5 and -2 > -8.",
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_06",
            lessonId: "lsn_01",
            type: "INTERACTIVE",
            sequenceOrder: 6,
            title: "6. Interactive Integer Number Line Explorer",
            content: "Click or step through values below to observe how numbers increase to the right, decrease to the left, and calculate their distance from zero (absolute value).",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_07",
            lessonId: "lsn_01",
            type: "QUESTION",
            sequenceOrder: 7,
            title: "7. Check Your Understanding",
            content: "Suppose the temperature in Baguio drops 4 degrees below zero Celsius. What integer represents this temperature?",
            metadata: JSON.stringify({
              question: "Suppose the temperature in Baguio drops 4 degrees below zero Celsius. What integer represents this temperature?",
              options: ["+4", "-4", "0"],
              correctAnswer: "-4",
              explanation: "Temperatures below freezing/zero are represented by negative integers. Hence, 4 degrees below zero is -4°C.",
              hint: "Think about whether 'below zero' corresponds to positive or negative on a vertical thermometer.",
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_08",
            lessonId: "lsn_01",
            type: "HINT",
            sequenceOrder: 8,
            title: "8. Pedagogical Tip: Comparing Negative Values",
            content: "When comparing two negative integers, the number with the smaller absolute value is actually the greater number! For example, $|-2| = 2$ and $|-9| = 9$. Because 2 is closer to 0 than 9, $-2 > -9$.",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_09",
            lessonId: "lsn_01",
            type: "PRACTICE",
            sequenceOrder: 9,
            title: "9. Targeted Skill Practice",
            content: "Ready to test your mastery? Try these formative exercises on integer recognition and comparison.",
            metadata: JSON.stringify({
              skillName: "Identify & Compare Integers (M7NS-Ia-1)",
              questionCount: 5,
              difficulty: "Introductory (Level 1)",
            }),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_10",
            lessonId: "lsn_01",
            type: "SUMMARY",
            sequenceOrder: 10,
            title: "10. Key Ideas & Takeaways",
            content:
              "• **Integers** include positive whole numbers, zero, and negative whole numbers: $\\mathbb{Z} = \\{ \\dots, -2, -1, 0, 1, 2, \\dots \\}$.\n• Integers can be graphed on a horizontal number line with $0$ as the center origin.\n• Numbers **increase** from left to right: $a > b$ if $a$ lies to the right of $b$.\n• The **absolute value** $|a|$ is the distance from $0$ to $a$ on the number line and is always non-negative.",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },

      // 2. Adding Integers
      {
        id: "lsn_02",
        unitId: "unt_01",
        authorId: "usr_teacher_01",
        sequenceOrder: 2,
        title: "Adding Integers",
        description: "Master sign rules for adding integers with the same signs and different signs using number lines and counters.",
        status: "PUBLISHED",
        prerequisiteLessonId: "lsn_01",
        learningObjectives: [
          "Add integers having the same signs by keeping the common sign",
          "Add integers with opposite signs by taking the sign of the greater magnitude",
          "Apply integer addition to practical financial and elevation scenarios",
        ],
        estimatedMinutes: 25,
        createdAt: new Date("2026-09-05"),
        updatedAt: new Date(),
        videoUrl: "https://www.youtube.com/watch?v=k5uW2t9xL6E",
        skillIds: ["skl_04", "skl_05"],
        resources: [
          {
            id: "res_yt_02",
            lessonId: "lsn_02",
            type: "YOUTUBE",
            title: "Mathisipan: Addition of Integers (Same Signs and Different Signs)",
            url: "https://www.youtube.com/watch?v=k5uW2t9xL6E",
            youtubeId: "k5uW2t9xL6E",
            provider: "YOUTUBE",
            channelName: "Mathisipan",
            thumbnailUrl: "https://img.youtube.com/vi/k5uW2t9xL6E/hqdefault.jpg",
            description: "Visual counter method and number line moves for adding integers with same and different signs.",
            duration: "15:20",
            status: "APPROVED",
            addedBy: "usr_teacher_01",
            notes: "Curated learning video from Mathisipan covering zero pairs and number line addition.",
            sequenceOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "res_note_02",
            lessonId: "lsn_02",
            type: "TEACHER_NOTE",
            title: "Color Counters Technique",
            notes:
              "Use two-color counters (yellow for positive, red for negative) to demonstrate zero pairs before formalizing algorithmic rules.",
            sequenceOrder: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        contentBlocks: [
          {
            id: "blk_201",
            lessonId: "lsn_02",
            type: "TEXT",
            sequenceOrder: 1,
            title: "1. Adding Integers with Like Signs",
            content:
              "When adding two integers with the same sign, add their absolute values and keep the common sign.\n\nExamples:\n• (+4) + (+5) = +9\n• (-3) + (-6) = -9",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_202",
            lessonId: "lsn_02",
            type: "EXAMPLE",
            sequenceOrder: 2,
            title: "2. Adding Integers with Unlike Signs",
            content:
              "When adding two integers with different signs, subtract the smaller absolute value from the larger absolute value, and attach the sign of the number with the larger absolute value.\n\nExample: (-8) + (+5)\n1. Compare absolute values: |-8| = 8, |+5| = 5.\n2. Subtract: 8 - 5 = 3.\n3. Take sign of greater magnitude: -3.",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_203",
            lessonId: "lsn_02",
            type: "SUMMARY",
            sequenceOrder: 3,
            title: "3. Addition Summary",
            content:
              "• Same sign: Add & keep sign.\n• Different signs: Subtract absolute values & keep sign of the larger magnitude.",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },

      // 3. Subtracting Integers
      {
        id: "lsn_03",
        unitId: "unt_01",
        authorId: "usr_teacher_01",
        sequenceOrder: 3,
        title: "Subtracting Integers",
        description: "Transform subtraction into addition by utilizing the additive inverse (Keep-Change-Change principle).",
        status: "PUBLISHED",
        prerequisiteLessonId: "lsn_02",
        learningObjectives: [
          "State and apply the additive inverse rule: a - b = a + (-b)",
          "Subtract negative and positive integers accurately",
          "Solve contextual word problems involving temperature drops and deficits",
        ],
        estimatedMinutes: 25,
        createdAt: new Date("2026-09-10"),
        updatedAt: new Date(),
        videoUrl: "https://www.youtube.com/watch?v=M8rK9p4q2Ds",
        skillIds: ["skl_06"],
        resources: [
          {
            id: "res_yt_03",
            lessonId: "lsn_03",
            type: "YOUTUBE",
            title: "Mathisipan: Subtraction of Integers and the Additive Inverse",
            url: "https://www.youtube.com/watch?v=M8rK9p4q2Ds",
            youtubeId: "M8rK9p4q2Ds",
            provider: "YOUTUBE",
            channelName: "Mathisipan",
            thumbnailUrl: "https://img.youtube.com/vi/M8rK9p4q2Ds/hqdefault.jpg",
            description: "Why subtracting a negative number is equivalent to adding a positive number. Conceptual and algebraic proofs.",
            duration: "14:10",
            status: "APPROVED",
            addedBy: "usr_teacher_01",
            notes: "Curated learning video explaining why subtracting is equivalent to adding the opposite.",
            sequenceOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "res_note_03",
            lessonId: "lsn_03",
            type: "TEACHER_NOTE",
            title: "Connecting to Addition",
            notes:
              "Reinforce that subtraction is simply adding the opposite. Students who master addition will master subtraction seamlessly.",
            sequenceOrder: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        contentBlocks: [
          {
            id: "blk_301",
            lessonId: "lsn_03",
            type: "TEXT",
            sequenceOrder: 1,
            title: "1. The Additive Inverse Rule",
            content:
              "To subtract an integer, add its additive inverse (its opposite):\n\n$$a - b = a + (-b)$$\n\nThis rule applies to all signed numbers without exception.",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: "blk_302",
            lessonId: "lsn_03",
            type: "EXAMPLE",
            sequenceOrder: 2,
            title: "2. Worked Example: Subtracting a Negative",
            content:
              "Problem: Calculate 7 - (-4)\n\nStep 1: Keep the first number: 7\nStep 2: Change subtraction to addition: +\nStep 3: Change (-4) to its opposite: +4\n\nResult: 7 + 4 = 11.",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      },
    ],
    competencies: [
      {
        id: "cmp_01",
        code: "M7NS-Ia-1",
        statement: "Describes and illustrates the sets of integers and integers on a number line.",
        sequenceOrder: 1,
      },
      {
        id: "cmp_02",
        code: "M7NS-Ib-1",
        statement: "Performs fundamental operations on integers: addition and subtraction.",
        sequenceOrder: 2,
      },
    ],
    skills: [
      {
        id: "skl_01",
        title: "Identify integers",
        description: "Differentiate between positive, negative, and zero integers in physical scenarios.",
        sequenceOrder: 1,
        difficulty: 1.0,
        competencyId: "cmp_01",
        prerequisiteIds: [],
      },
      {
        id: "skl_02",
        title: "Compare integers",
        description: "Use inequality symbols (<, >, =) to compare signed values.",
        sequenceOrder: 2,
        difficulty: 1.5,
        competencyId: "cmp_01",
        prerequisiteIds: ["skl_01"],
      },
      {
        id: "skl_03",
        title: "Represent integers on a number line",
        description: "Plot and translate points on a discrete horizontal axis.",
        sequenceOrder: 3,
        difficulty: 2.0,
        competencyId: "cmp_01",
        prerequisiteIds: ["skl_02"],
      },
      {
        id: "skl_04",
        title: "Same-sign addition",
        description: "Add positive and negative integers with like signs.",
        sequenceOrder: 4,
        difficulty: 2.2,
        competencyId: "cmp_02",
        prerequisiteIds: ["skl_02"],
      },
      {
        id: "skl_05",
        title: "Different-sign addition",
        description: "Add integers with opposite signs by subtracting absolute values.",
        sequenceOrder: 5,
        difficulty: 2.5,
        competencyId: "cmp_02",
        prerequisiteIds: ["skl_04"],
      },
      {
        id: "skl_06",
        title: "Additive inverse and subtraction",
        description: "Transform subtraction into addition using the opposite value.",
        sequenceOrder: 6,
        difficulty: 2.8,
        competencyId: "cmp_02",
        prerequisiteIds: ["skl_05"],
      },
    ],
  },
  progress: [
    // Pre-seeded progress: Juan de la Cruz has COMPLETED Lesson 1 ("Understanding Integers")
    {
      id: "prg_01",
      userId: "usr_student_01",
      lessonId: "lsn_01",
      status: "COMPLETED",
      progressPercentage: 100,
      startedAt: new Date("2026-09-20"),
      completedAt: new Date("2026-09-22"),
      understandingScore: 0.85,
      accuracyScore: 0.8,
      applicationScore: 0.85,
      consistencyScore: 0.75,
      compositeScore: 0.81,
      attemptCount: 3,
      lastActivity: new Date("2026-09-22"),
    },
    // Skills of Lesson 1 completed
    {
      id: "prg_s01",
      userId: "usr_student_01",
      skillId: "skl_01",
      status: "COMPLETED",
      progressPercentage: 100,
      startedAt: new Date("2026-09-20"),
      completedAt: new Date("2026-09-21"),
      understandingScore: 0.9,
      accuracyScore: 0.9,
      applicationScore: 0.85,
      consistencyScore: 0.8,
      compositeScore: 0.86,
      attemptCount: 2,
      lastActivity: new Date("2026-09-21"),
    },
    {
      id: "prg_s02",
      userId: "usr_student_01",
      skillId: "skl_02",
      status: "COMPLETED",
      progressPercentage: 100,
      startedAt: new Date("2026-09-21"),
      completedAt: new Date("2026-09-22"),
      understandingScore: 0.85,
      accuracyScore: 0.8,
      applicationScore: 0.85,
      consistencyScore: 0.75,
      compositeScore: 0.81,
      attemptCount: 2,
      lastActivity: new Date("2026-09-22"),
    },
    {
      id: "prg_s03",
      userId: "usr_student_01",
      skillId: "skl_03",
      status: "COMPLETED",
      progressPercentage: 100,
      startedAt: new Date("2026-09-21"),
      completedAt: new Date("2026-09-22"),
      understandingScore: 0.8,
      accuracyScore: 0.85,
      applicationScore: 0.8,
      consistencyScore: 0.7,
      compositeScore: 0.79,
      attemptCount: 2,
      lastActivity: new Date("2026-09-22"),
    },
    // Lesson 2 ("Adding Integers") is currently IN_PROGRESS (60%)
    {
      id: "prg_02",
      userId: "usr_student_01",
      lessonId: "lsn_02",
      status: "LEARNING",
      progressPercentage: 60,
      startedAt: new Date("2026-09-25"),
      understandingScore: 0.6,
      accuracyScore: 0.55,
      applicationScore: 0.6,
      consistencyScore: 0.5,
      compositeScore: 0.56,
      attemptCount: 1,
      lastActivity: new Date("2026-09-26"),
    },
  ],
  sessions: [
    {
      id: "ses_01",
      userId: "usr_student_01",
      lessonId: "lsn_01",
      currentSectionIndex: 0,
      completedBlockIds: ["blk_01", "blk_02", "blk_03", "blk_04", "blk_05", "blk_06", "blk_07", "blk_08", "blk_09", "blk_10"],
      startedAt: new Date("2026-09-20"),
      lastActivityAt: new Date("2026-09-22"),
      completedAt: new Date("2026-09-22"),
    },
    {
      id: "ses_02",
      userId: "usr_student_01",
      lessonId: "lsn_02",
      currentSectionIndex: 1,
      completedBlockIds: ["blk_201"],
      startedAt: new Date("2026-09-25"),
      lastActivityAt: new Date("2026-09-26"),
    },
  ],
  checkpointAttempts: [
    {
      id: "chk_01",
      userId: "usr_student_01",
      lessonId: "lsn_01",
      blockId: "blk_05",
      attempt: 1,
      answer: "-2",
      isCorrect: true,
      feedback: "On a horizontal number line, numbers farther to the right are greater. -2 is to the right of -5 and -8, so -2 > -5 and -2 > -8.",
      createdAt: new Date("2026-09-21"),
    },
  ],
  questions: [
    {
      id: "qst_01",
      lessonId: "lsn_01",
      skillId: "skl_01",
      type: "MULTIPLE_CHOICE",
      prompt: "Which of the following numbers is an **integer**?",
      explanation: "Integers are whole numbers that can be positive, negative, or zero (without fractional or decimal parts). $\\frac{1}{2}$ is a fraction, $3.75$ has a decimal part, and $\\sqrt{2}$ is irrational. Thus, $-9$ is the only integer.",
      difficulty: "EASY",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        choices: [
          { id: "opt_a", text: "3.75" },
          { id: "opt_b", text: "\\frac{1}{2}" },
          { id: "opt_c", text: "-9" },
          { id: "opt_d", text: "\\sqrt{2}" },
        ],
        correctAnswer: "opt_c",
      }),
      correctFeedback: "Correct! -9 is a negative whole number with no fractional component.",
      incorrectFeedback: "Recall that integers cannot have fractional or decimal parts. Review the definition of whole signed numbers.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-15"),
      updatedAt: new Date("2026-09-15"),
    },
    {
      id: "qst_02",
      lessonId: "lsn_01",
      skillId: "skl_01",
      type: "MULTIPLE_CHOICE",
      prompt: "A research vessel measures an underwater cave at $250$ meters below sea level in Palawan. Which signed integer represents this elevation?",
      explanation: "Standard mathematical convention assigns positive numbers to elevations above sea level and negative numbers to depths below sea level. Sea level is the 0 baseline. Thus, $250$ meters below sea level is $-250$.",
      difficulty: "EASY",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        choices: [
          { id: "opt_a", text: "+250" },
          { id: "opt_b", text: "-250" },
          { id: "opt_c", text: "0" },
          { id: "opt_d", text: "-25" },
        ],
        correctAnswer: "opt_b",
      }),
      correctFeedback: "Spot on! Below sea level corresponds to a negative integer.",
      incorrectFeedback: "Think about the reference zero level: is being beneath the surface a gain or a deficit?",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-15"),
      updatedAt: new Date("2026-09-15"),
    },
    {
      id: "qst_03",
      lessonId: "lsn_01",
      skillId: "skl_01",
      type: "NUMERIC_INPUT",
      prompt: "Find the absolute value of $-14$:\n\n$$|-14| = ?$$",
      explanation: "The absolute value of a real number is its distance from zero along the number line without direction. Since $-14$ is located 14 units away from zero, $|-14| = 14$. Absolute value is always non-negative.",
      difficulty: "EASY",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        correctAnswer: "14",
        tolerance: 0,
      }),
      correctFeedback: "Excellent! Absolute value represents distance and is always positive or zero.",
      incorrectFeedback: "Remember that distance is never negative. How many units is -14 away from 0?",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-15"),
      updatedAt: new Date("2026-09-15"),
    },
    {
      id: "qst_04",
      lessonId: "lsn_01",
      skillId: "skl_01",
      type: "TEXT_INPUT",
      prompt: "What is the opposite (additive inverse) of $-8$?",
      explanation: "The opposite (or additive inverse) of any integer $a$ is $-a$ such that $a + (-a) = 0$. The opposite of $-8$ is $+8$ (or simply $8$).",
      difficulty: "EASY",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        correctAnswer: "8",
        acceptableAnswers: ["+8", "positive 8", "8"],
        caseSensitive: false,
        trimWhitespace: true,
      }),
      correctFeedback: "Correct! The opposite of -8 is positive 8.",
      incorrectFeedback: "Think about the number that lies on the opposite side of 0 at the exact same distance.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-15"),
      updatedAt: new Date("2026-09-15"),
    },
    {
      id: "qst_05",
      lessonId: "lsn_01",
      skillId: "skl_02",
      type: "TRUE_FALSE",
      prompt: "True or False: On a standard horizontal number line, $-5$ is greater than $-2$.",
      explanation: "On a horizontal number line, numbers increase as you move from left to right. Since $-2$ is to the right of $-5$, $-2 > -5$, which means $-5$ is less than $-2$. Therefore, the statement is False.",
      difficulty: "EASY",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        correctAnswer: false,
      }),
      correctFeedback: "Correct! -2 is to the right of -5, so -2 > -5.",
      incorrectFeedback: "Visualize the number line: is -5 located to the right or to the left of -2?",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-15"),
      updatedAt: new Date("2026-09-15"),
    },
    {
      id: "qst_06",
      lessonId: "lsn_01",
      skillId: "skl_01",
      type: "TRUE_FALSE",
      prompt: "True or False: The number zero ($0$) is neither positive nor negative.",
      explanation: "Zero is the origin dividing positive and negative numbers. It is neutral and is neither positive nor negative.",
      difficulty: "EASY",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        correctAnswer: true,
      }),
      correctFeedback: "Correct! Zero is neutral; it is neither positive nor negative.",
      incorrectFeedback: "Remember that zero marks the center boundary between positive and negative numbers.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-15"),
      updatedAt: new Date("2026-09-15"),
    },
    {
      id: "qst_07",
      lessonId: "lsn_01",
      skillId: "skl_02",
      type: "MULTIPLE_CHOICE",
      prompt: "Which of the following inequality statements is **true**?",
      explanation: "On a number line, a number is greater than another if it is situated farther to the right. $-15$ is located to the left of $-3$, so $-15 < -3$ is true. Contrastingly, $-10$ is not $> -4$, $-7$ is not $< -12$, and $0$ is not $< -6$.",
      difficulty: "MEDIUM",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        choices: [
          { id: "opt_a", text: "-10 > -4" },
          { id: "opt_b", text: "-7 < -12" },
          { id: "opt_c", text: "-15 < -3" },
          { id: "opt_d", text: "0 < -6" },
        ],
        correctAnswer: "opt_c",
      }),
      correctFeedback: "Great work! -15 is indeed less than -3 because it is farther to the left.",
      incorrectFeedback: "For negative numbers, the number with the larger absolute value is smaller. Test each option on a mental number line.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-15"),
      updatedAt: new Date("2026-09-15"),
    },
    {
      id: "qst_08",
      lessonId: "lsn_02",
      skillId: "skl_04",
      type: "NUMERIC_INPUT",
      prompt: "Evaluate the sum of like-signed integers:\n\n$$(-6) + (-9) = ?$$",
      explanation: "Rule for adding integers with the same sign: Add their absolute values and attach the common sign. $|-6| + |-9| = 6 + 9 = 15$. Since both are negative, the sum is $-15$.",
      difficulty: "MEDIUM",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        correctAnswer: "-15",
        tolerance: 0,
      }),
      correctFeedback: "Correct! Adding two negatives yields a negative sum.",
      incorrectFeedback: "Remember the rule: when both numbers have the same sign, add their magnitudes and keep the sign.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-16"),
      updatedAt: new Date("2026-09-16"),
    },
    {
      id: "qst_09",
      lessonId: "lsn_02",
      skillId: "skl_05",
      type: "NUMERIC_INPUT",
      prompt: "Evaluate the sum of integers with different signs:\n\n$$(-8) + 13 = ?$$",
      explanation: "Rule for adding integers with unlike signs: Subtract the smaller absolute value from the larger absolute value, and keep the sign of the number with the larger absolute value. $|13| - |-8| = 13 - 8 = 5$. Since $13 > 8$ and $13$ is positive, the result is $+5$.",
      difficulty: "MEDIUM",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        correctAnswer: "5",
        tolerance: 0,
      }),
      correctFeedback: "Well done! 13 is 5 greater than 8, giving +5.",
      incorrectFeedback: "Compare the magnitudes: $|13| = 13$ and $|-8| = 8$. Subtract the smaller from the larger and attach the sign of the greater magnitude.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-16"),
      updatedAt: new Date("2026-09-16"),
    },
    {
      id: "qst_10",
      lessonId: "lsn_01",
      skillId: "skl_01",
      type: "EQUATION",
      prompt: "Solve the linear equation for $x$:\n\n$$x + 5 = 12$$",
      explanation: "To isolate $x$, subtract $5$ from both sides of the equation:\n$$x + 5 - 5 = 12 - 5 \\implies x = 7$$",
      difficulty: "MEDIUM",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        correctAnswer: "x = 7",
        acceptableAnswers: ["x=7", "7=x", "7"],
      }),
      correctFeedback: "Perfect! x = 7 satisfies the equation.",
      incorrectFeedback: "Apply the subtraction property of equality: subtract 5 from both sides.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-16"),
      updatedAt: new Date("2026-09-16"),
    },
    {
      id: "qst_11",
      lessonId: "lsn_03",
      skillId: "skl_06",
      type: "EQUATION",
      prompt: "Solve for $y$ using the additive inverse property:\n\n$$y - (-4) = 11$$",
      explanation: "Subtracting a negative is equivalent to adding its positive counterpart:\n$$y - (-4) = y + 4 = 11$$\nSubtracting $4$ from both sides gives:\n$$y = 11 - 4 = 7$$",
      difficulty: "HARD",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        correctAnswer: "y = 7",
        acceptableAnswers: ["y=7", "7=y", "7"],
      }),
      correctFeedback: "Outstanding! Subtracting -4 became +4, giving y = 7.",
      incorrectFeedback: "Remember the additive inverse rule: subtracting a negative integer is the same as adding a positive integer.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-17"),
      updatedAt: new Date("2026-09-17"),
    },
    {
      id: "qst_12",
      lessonId: "lsn_01",
      skillId: "skl_01",
      type: "MATCHING",
      prompt: "Match each integer with its corresponding **additive inverse** (opposite):",
      explanation: "The additive inverse of $a$ is $-a$ such that $a + (-a) = 0$. Thus: $-5 \\to 5$, $3 \\to -3$, $-12 \\to 12$, and $0 \\to 0$.",
      difficulty: "MEDIUM",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        matchingPairs: [
          { left: "-5", right: "5" },
          { left: "3", right: "-3" },
          { left: "-12", right: "12" },
          { left: "0", right: "0" },
        ],
      }),
      correctFeedback: "All pairs matched correctly! Each number is matched with its opposite.",
      incorrectFeedback: "Double check your pairs: each integer must pair with the value that adds up to 0.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-17"),
      updatedAt: new Date("2026-09-17"),
    },
    {
      id: "qst_13",
      lessonId: "lsn_01",
      skillId: "skl_02",
      type: "ORDERING",
      prompt: "Arrange the integers in order from **least to greatest**:\n\n$$3,\\; -5,\\; 0,\\; -2$$",
      explanation: "Numbers increase as we move from left to right along the number line. The farthest left is $-5$, followed by $-2$, then $0$, and finally $3$. Therefore, $-5 < -2 < 0 < 3$.",
      difficulty: "MEDIUM",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        orderingItems: ["-5", "-2", "0", "3"],
      }),
      correctFeedback: "Excellent! The sequence -5, -2, 0, 3 is in correct ascending order.",
      incorrectFeedback: "Remember: the more negative a number is, the further left it lies on the number line.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-17"),
      updatedAt: new Date("2026-09-17"),
    },
    {
      id: "qst_14",
      lessonId: "lsn_01",
      skillId: "skl_02",
      type: "ORDERING",
      prompt: "Arrange the following integers from **greatest to least**:\n\n$$-11,\\; 4,\\; -1,\\; 8,\\; -6$$",
      explanation: "Descending order requires starting with the largest positive value and moving left: $8 > 4 > -1 > -6 > -11$.",
      difficulty: "HARD",
      status: "PUBLISHED",
      source: "TEACHER",
      createdById: "usr_teacher_01",
      reviewedById: "usr_admin_01",
      questionData: JSON.stringify({
        orderingItems: ["8", "4", "-1", "-6", "-11"],
      }),
      correctFeedback: "Spot on! The sequence is correctly arranged in descending order.",
      incorrectFeedback: "Notice that this question asks for greatest to least (descending). Start with the largest positive number.",
      allowRetry: true,
      maxAttempts: 3,
      createdAt: new Date("2026-09-17"),
      updatedAt: new Date("2026-09-17"),
    },
  ],
  practiceSets: [
    {
      id: "ps_integers_basics",
      title: "Understanding Integers: Core Practice",
      description: "Master identifying signed integers, opposites, absolute values, comparison rules, and linear equations.",
      lessonId: "lsn_01",
      skillId: "skl_01",
      status: "PUBLISHED",
      questionCount: 8,
      createdById: "usr_teacher_01",
      createdAt: new Date("2026-09-18"),
      updatedAt: new Date("2026-09-18"),
    },
    {
      id: "ps_integers_operations",
      title: "Integer Operations & Ordering Practice",
      description: "Practice multi-step ordering, signed addition with like and unlike signs, and algebraic additive inverses.",
      lessonId: "lsn_02",
      skillId: "skl_04",
      status: "PUBLISHED",
      questionCount: 6,
      createdById: "usr_teacher_01",
      createdAt: new Date("2026-09-19"),
      updatedAt: new Date("2026-09-19"),
    },
  ],
  practiceSetQuestions: [
    // Practice Set 1: Understanding Integers Core Practice (8 questions)
    { id: "psq_01", practiceSetId: "ps_integers_basics", questionId: "qst_01", order: 1 },
    { id: "psq_02", practiceSetId: "ps_integers_basics", questionId: "qst_02", order: 2 },
    { id: "psq_03", practiceSetId: "ps_integers_basics", questionId: "qst_03", order: 3 },
    { id: "psq_04", practiceSetId: "ps_integers_basics", questionId: "qst_04", order: 4 },
    { id: "psq_05", practiceSetId: "ps_integers_basics", questionId: "qst_05", order: 5 },
    { id: "psq_06", practiceSetId: "ps_integers_basics", questionId: "qst_10", order: 6 },
    { id: "psq_07", practiceSetId: "ps_integers_basics", questionId: "qst_12", order: 7 },
    { id: "psq_08", practiceSetId: "ps_integers_basics", questionId: "qst_13", order: 8 },

    // Practice Set 2: Integer Operations & Ordering Practice (6 questions)
    { id: "psq_11", practiceSetId: "ps_integers_operations", questionId: "qst_06", order: 1 },
    { id: "psq_12", practiceSetId: "ps_integers_operations", questionId: "qst_07", order: 2 },
    { id: "psq_13", practiceSetId: "ps_integers_operations", questionId: "qst_08", order: 3 },
    { id: "psq_14", practiceSetId: "ps_integers_operations", questionId: "qst_09", order: 4 },
    { id: "psq_15", practiceSetId: "ps_integers_operations", questionId: "qst_11", order: 5 },
    { id: "psq_16", practiceSetId: "ps_integers_operations", questionId: "qst_14", order: 6 },
  ],
  practiceSessions: [
    {
      id: "pses_01",
      studentId: "usr_student_01",
      practiceSetId: "ps_integers_basics",
      lessonId: "lsn_01",
      skillId: "skl_01",
      status: "COMPLETED",
      startedAt: new Date("2026-09-22T08:00:00Z"),
      completedAt: new Date("2026-09-22T08:14:00Z"),
      score: 87.5,
      totalQuestions: 8,
      correctAnswers: 7,
      createdAt: new Date("2026-09-22T08:00:00Z"),
      updatedAt: new Date("2026-09-22T08:14:00Z"),
    },
  ],
  practiceSessionQuestions: [
    { id: "psq_s01", practiceSessionId: "pses_01", questionId: "qst_01", order: 1, completedAt: new Date("2026-09-22T08:01:00Z") },
    { id: "psq_s02", practiceSessionId: "pses_01", questionId: "qst_02", order: 2, completedAt: new Date("2026-09-22T08:02:30Z") },
    { id: "psq_s03", practiceSessionId: "pses_01", questionId: "qst_03", order: 3, completedAt: new Date("2026-09-22T08:04:00Z") },
    { id: "psq_s04", practiceSessionId: "pses_01", questionId: "qst_04", order: 4, completedAt: new Date("2026-09-22T08:05:40Z") },
    { id: "psq_s05", practiceSessionId: "pses_01", questionId: "qst_05", order: 5, completedAt: new Date("2026-09-22T08:07:10Z") },
    { id: "psq_s06", practiceSessionId: "pses_01", questionId: "qst_10", order: 6, completedAt: new Date("2026-09-22T08:09:00Z") },
    { id: "psq_s07", practiceSessionId: "pses_01", questionId: "qst_12", order: 7, completedAt: new Date("2026-09-22T08:11:30Z") },
    { id: "psq_s08", practiceSessionId: "pses_01", questionId: "qst_13", order: 8, completedAt: new Date("2026-09-22T08:14:00Z") },
  ],
  questionAttempts: [
    { id: "att_01", studentId: "usr_student_01", questionId: "qst_01", practiceSessionId: "pses_01", skillId: "skl_01", answer: "opt_c", isCorrect: true, attemptNumber: 1, timeTakenMs: 45000, hintUsed: false, submittedAt: new Date("2026-09-22T08:01:00Z") },
    { id: "att_02", studentId: "usr_student_01", questionId: "qst_02", practiceSessionId: "pses_01", skillId: "skl_01", answer: "opt_b", isCorrect: true, attemptNumber: 1, timeTakenMs: 62000, hintUsed: false, submittedAt: new Date("2026-09-22T08:02:30Z") },
    { id: "att_03", studentId: "usr_student_01", questionId: "qst_03", practiceSessionId: "pses_01", skillId: "skl_01", answer: "14", isCorrect: true, attemptNumber: 1, timeTakenMs: 38000, hintUsed: false, submittedAt: new Date("2026-09-22T08:04:00Z") },
    { id: "att_04", studentId: "usr_student_01", questionId: "qst_04", practiceSessionId: "pses_01", skillId: "skl_01", answer: "8", isCorrect: true, attemptNumber: 1, timeTakenMs: 41000, hintUsed: false, submittedAt: new Date("2026-09-22T08:05:40Z") },
    { id: "att_05", studentId: "usr_student_01", questionId: "qst_05", practiceSessionId: "pses_01", skillId: "skl_02", answer: "false", isCorrect: true, attemptNumber: 1, timeTakenMs: 50000, hintUsed: false, submittedAt: new Date("2026-09-22T08:07:10Z") },
    { id: "att_06", studentId: "usr_student_01", questionId: "qst_10", practiceSessionId: "pses_01", skillId: "skl_01", answer: "x = 7", isCorrect: true, attemptNumber: 1, timeTakenMs: 55000, hintUsed: false, submittedAt: new Date("2026-09-22T08:09:00Z") },
    { id: "att_07_1", studentId: "usr_student_01", questionId: "qst_12", practiceSessionId: "pses_01", skillId: "skl_01", answer: JSON.stringify({ "-5": "-5", "3": "3" }), isCorrect: false, attemptNumber: 1, timeTakenMs: 70000, hintUsed: true, submittedAt: new Date("2026-09-22T08:11:00Z") },
    { id: "att_07_2", studentId: "usr_student_01", questionId: "qst_12", practiceSessionId: "pses_01", skillId: "skl_01", answer: JSON.stringify({ "-5": "5", "3": "-3", "-12": "12", "0": "0" }), isCorrect: true, attemptNumber: 2, timeTakenMs: 30000, hintUsed: false, submittedAt: new Date("2026-09-22T08:11:30Z") },
    { id: "att_08", studentId: "usr_student_01", questionId: "qst_13", practiceSessionId: "pses_01", skillId: "skl_02", answer: JSON.stringify(["-5", "-2", "0", "3"]), isCorrect: true, attemptNumber: 1, timeTakenMs: 95000, hintUsed: false, submittedAt: new Date("2026-09-22T08:14:00Z") },
  ],
  aiConversations: [
    {
      id: "conv_seed_01",
      studentId: "usr_student_01",
      lessonId: "lsn_01",
      skillId: "skl_01",
      questionId: "qst_12",
      practiceSessionId: "pses_01",
      createdAt: new Date("2026-09-22T08:10:00Z"),
      updatedAt: new Date("2026-09-22T08:11:00Z"),
    },
  ],
  aiMessages: [
    {
      id: "aimsg_seed_01",
      conversationId: "conv_seed_01",
      role: "STUDENT",
      content: "I need a hint for matching opposite numbers.",
      messageType: "QUESTION",
      hintLevel: 1,
      guidingQuestion: null,
      metadata: null,
      createdAt: new Date("2026-09-22T08:10:15Z"),
    },
    {
      id: "aimsg_seed_02",
      conversationId: "conv_seed_01",
      role: "TUTOR",
      content: "The additive inverse (or opposite) of any integer $a$ is the number $-a$ that equals $0$ when added together: $a + (-a) = 0$. For example, the opposite of $+7$ is $-7$, and the opposite of $-10$ is $+10$.",
      messageType: "HINT",
      hintLevel: 1,
      guidingQuestion: "What number added to -5 will give you exactly 0?",
      metadata: JSON.stringify({ encouragement: "You can do this!" }),
      createdAt: new Date("2026-09-22T08:10:30Z"),
    },
  ],
  teacherAISettings: {
    aiTutorEnabled: true,
    maxHintLevel: 3,
    model: "gemini-3.8-flash",
    allowDirectStudentChat: true,
    provider: "gemini",
  },
  mistakeAnalyses: [
    {
      id: "mana_seed_01",
      studentId: "usr_student_01",
      skillId: "skl_02",
      lessonId: "lsn_01",
      practiceSessionId: "pses_01",
      category: "CONCEPTUAL_MISUNDERSTANDING",
      observation: "Student answered questions comparing negative integers with lower accuracy.",
      pattern: "Selected the negative number with larger absolute value as the greater number (-5 chosen over -2).",
      possibleCause: "Applying whole number magnitude rules to negative integers without number-line orientation.",
      confidence: 0.84,
      recommendation: "Practice placing pairs of integers on a number line to visualize that numbers farther to the right are always greater.",
      evidenceSummary: "Identified in practice session pses_01 across 2 incorrect attempts.",
      status: "COMPLETED",
      trigger: "PRACTICE_COMPLETED",
      analyzerVersion: "1.0",
      metadata: JSON.stringify({ model: "gemini-3.8-flash", accuracy: 50 }),
      createdAt: new Date("2026-09-22T08:15:00Z"),
      updatedAt: new Date("2026-09-22T08:15:00Z"),
    },
  ],
  mistakeAnalysisEvidences: [
    {
      id: "mev_seed_01",
      analysisId: "mana_seed_01",
      attemptId: "att_05",
      relevanceScore: 1.0,
      notes: "Selected false for integer ordering statement",
      createdAt: new Date("2026-09-22T08:15:00Z"),
    },
  ],
  adaptiveRecommendations: [
    {
      id: "adrec_seed_01",
      studentId: "usr_student_01",
      skillId: "skl_02",
      lessonId: "lsn_01",
      decisionType: "PRACTICE_SAME_DIFFICULTY",
      reason: "Accuracy of 70% indicates healthy developing progress. Continuing at current difficulty.",
      evidenceSummary: "Attempts: 5 | Accuracy: 70% | Trend: STABLE | Hints: 1 | Primary Mistake: SIGN_ERROR | Rule: RULE_PRACTICE_SAME_DIFFICULTY",
      confidence: "MEDIUM",
      recommendedActivityType: "PRACTICE_SET",
      recommendedActivityId: "ps_integers_basics",
      source: "RULE_ENGINE",
      status: "ACTIVE",
      targetDifficulty: "MEDIUM",
      metadata: JSON.stringify({
        ruleCode: "RULE_PRACTICE_SAME_DIFFICULTY",
        activityTitle: "Integer Operations Practice Set (medium practice)",
        practiceSetId: "ps_integers_basics",
        explanation: {
          message: "Great progress! You are steadily developing your skills in Compare integers.",
          reason: "Consistent practice at this level locks in your accuracy (70%).",
          nextStep: "Continue practice: Integer Operations Practice Set (medium practice)",
          encouragement: "Keep the momentum going!",
        },
      }),
      createdAt: new Date("2026-09-22T08:20:00Z"),
      updatedAt: new Date("2026-09-22T08:20:00Z"),
      expiresAt: new Date("2026-10-22T08:20:00Z"),
    },
  ],
  adaptiveRecommendationOverrides: [],
  skillMasteries: [
    {
      id: "mstr_seed_01",
      studentId: "usr_student_01",
      skillId: "skl_01", // "Identify integers"
      status: "PROFICIENT",
      evidenceSummary: "10 attempts with 90% accuracy across multiple choice and true/false questions. Consistent understanding of integer concepts.",
      accuracy: 0.9,
      recentAccuracy: 1.0,
      consistencyScore: 0.85,
      applicationScore: 0.8,
      attemptCount: 10,
      masteryVersion: "MASTERY_V1",
      metadata: JSON.stringify({
        ruleCode: "RULE_PROFICIENT",
        ruleDescription: "Demonstrates consistent high accuracy across foundational question types.",
        difficulty: {
          EASY: { attempts: 6, correct: 6, accuracy: 1.0 },
          MEDIUM: { attempts: 4, correct: 3, accuracy: 0.75 },
          HARD: { attempts: 0, correct: 0, accuracy: 0.0 },
        },
        questionTypes: {
          MULTIPLE_CHOICE: { attempts: 7, correct: 6, accuracy: 0.86 },
          TRUE_FALSE: { attempts: 3, correct: 3, accuracy: 1.0 },
        },
        explanation: {
          level: "PROFICIENT",
          summary: "You demonstrate strong and consistent understanding of identifying positive and negative integers.",
          why: "Recent practice shows 100% accuracy and reliable recall across different question formats.",
          nextStep: "Maintain your proficiency by practicing application problems.",
          encouragement: "Great work! You have built a reliable foundation in this skill.",
        },
      }),
      lastEvaluatedAt: new Date("2026-09-22T08:25:00Z"),
      createdAt: new Date("2026-09-20T08:00:00Z"),
      updatedAt: new Date("2026-09-22T08:25:00Z"),
    },
    {
      id: "mstr_seed_02",
      studentId: "usr_student_01",
      skillId: "skl_02", // "Compare integers"
      status: "DEVELOPING",
      evidenceSummary: "7 attempts with 71% accuracy. Minor sign errors when comparing negative integers.",
      accuracy: 0.71,
      recentAccuracy: 0.67,
      consistencyScore: 0.6,
      applicationScore: 0.5,
      attemptCount: 7,
      masteryVersion: "MASTERY_V1",
      metadata: JSON.stringify({
        ruleCode: "RULE_DEVELOPING",
        ruleDescription: "Shows partial understanding but still demonstrates occasional sign errors on negative comparison.",
        difficulty: {
          EASY: { attempts: 4, correct: 3, accuracy: 0.75 },
          MEDIUM: { attempts: 3, correct: 2, accuracy: 0.67 },
          HARD: { attempts: 0, correct: 0, accuracy: 0.0 },
        },
        questionTypes: {
          MULTIPLE_CHOICE: { attempts: 5, correct: 4, accuracy: 0.8 },
          NUMERIC_INPUT: { attempts: 2, correct: 1, accuracy: 0.5 },
        },
        explanation: {
          level: "DEVELOPING",
          summary: "You understand how to compare numbers, but negative numbers still need a little care.",
          why: "Recent practice shows sign confusion when comparing two negative numbers.",
          nextStep: "Continue practice comparing integers at medium difficulty.",
          encouragement: "You're making steady progress. Each problem strengthens your intuition!",
        },
      }),
      lastEvaluatedAt: new Date("2026-09-22T08:25:00Z"),
      createdAt: new Date("2026-09-20T08:00:00Z"),
      updatedAt: new Date("2026-09-22T08:25:00Z"),
    },
    {
      id: "mstr_seed_03",
      studentId: "usr_student_01",
      skillId: "skl_03", // "Order integers"
      status: "LEARNING",
      evidenceSummary: "3 attempts with 66% accuracy. Starting to grasp ordering but requires more practice.",
      accuracy: 0.66,
      recentAccuracy: 0.66,
      consistencyScore: 0.4,
      applicationScore: 0.3,
      attemptCount: 3,
      masteryVersion: "MASTERY_V1",
      metadata: JSON.stringify({
        ruleCode: "RULE_LEARNING",
        explanation: {
          level: "LEARNING",
          summary: "You've started exploring how to order integers from least to greatest.",
          why: "Limited evidence so far with 3 practice questions completed.",
          nextStep: "Complete more practice exercises on ordering integers.",
          encouragement: "Every math journey starts here. Take it step-by-step!",
        },
      }),
      lastEvaluatedAt: new Date("2026-09-22T08:25:00Z"),
      createdAt: new Date("2026-09-20T08:00:00Z"),
      updatedAt: new Date("2026-09-22T08:25:00Z"),
    },
    {
      id: "mstr_seed_04",
      studentId: "usr_student_01",
      skillId: "skl_04", // "Same-sign addition"
      status: "NOT_STARTED",
      evidenceSummary: "No practice attempts logged yet.",
      accuracy: 0.0,
      recentAccuracy: 0.0,
      consistencyScore: 0.0,
      applicationScore: 0.0,
      attemptCount: 0,
      masteryVersion: "MASTERY_V1",
      metadata: JSON.stringify({
        ruleCode: "RULE_NOT_STARTED",
        explanation: {
          level: "NOT_STARTED",
          summary: "You haven't attempted this skill yet.",
          why: "No practice or checkpoint questions completed.",
          nextStep: "Start with the interactive lesson on Adding Integers.",
          encouragement: "Ready to discover something new? Let's dive in!",
        },
      }),
      lastEvaluatedAt: new Date("2026-09-22T08:25:00Z"),
      createdAt: new Date("2026-09-20T08:00:00Z"),
      updatedAt: new Date("2026-09-22T08:25:00Z"),
    },
  ],
  skillMasteryHistory: [
    {
      id: "mstr_hist_01",
      skillMasteryId: "mstr_seed_01",
      previousStatus: "DEVELOPING",
      newStatus: "PROFICIENT",
      reason: "Completed 5 consecutive correct problems with 100% recent accuracy.",
      evidenceSummary: "Recent accuracy reached 100% with no recurring misconceptions.",
      masteryVersion: "MASTERY_V1",
      createdAt: new Date("2026-09-22T08:25:00Z"),
    },
  ],
  classrooms: [
    {
      id: "cls_01",
      name: "Grade 7 - Section Rizal",
      gradeLevel: 7,
      subject: "Mathematics",
      schoolYear: "2026-2027",
      teacherId: "usr_teacher_01",
      createdAt: new Date("2026-08-15T00:00:00Z"),
      updatedAt: new Date("2026-08-15T00:00:00Z"),
    },
    {
      id: "cls_02",
      name: "Grade 7 - Section Bonifacio",
      gradeLevel: 7,
      subject: "Mathematics",
      schoolYear: "2026-2027",
      teacherId: "usr_teacher_01",
      createdAt: new Date("2026-08-15T00:00:00Z"),
      updatedAt: new Date("2026-08-15T00:00:00Z"),
    },
  ],
  classroomEnrollments: [
    {
      id: "enr_01",
      classroomId: "cls_01",
      studentId: "usr_student_01", // Juan de la Cruz
      enrolledAt: new Date("2026-08-16T00:00:00Z"),
    },
    {
      id: "enr_02",
      classroomId: "cls_01",
      studentId: "usr_student_02", // Maria Clara
      enrolledAt: new Date("2026-08-16T00:00:00Z"),
    },
    {
      id: "enr_03",
      classroomId: "cls_01",
      studentId: "usr_student_03", // Crisostomo Ibarra
      enrolledAt: new Date("2026-08-16T00:00:00Z"),
    },
    {
      id: "enr_04",
      classroomId: "cls_02",
      studentId: "usr_student_04", // Basilio Magalang
      enrolledAt: new Date("2026-08-16T00:00:00Z"),
    },
    {
      id: "enr_05",
      classroomId: "cls_02",
      studentId: "usr_student_05", // Elias Salvi
      enrolledAt: new Date("2026-08-16T00:00:00Z"),
    },
  ],
  resourceChunks: [],
  assignments: [
    {
      id: "asg_01",
      classroomId: "cls_01",
      title: "Understanding Integers Interactive Module",
      description: "Complete all interactive sections and checkpoints for Lesson 1.",
      lessonId: "lsn_01",
      practiceSetId: "ps_integers_basics",
      dueDate: new Date(Date.now() + 86400000 * 7),
      status: "PUBLISHED",
      createdAt: new Date("2026-09-18T00:00:00Z"),
      updatedAt: new Date("2026-09-18T00:00:00Z"),
    },
    {
      id: "asg_02",
      classroomId: "cls_01",
      title: "Addition of Integers: Same-Sign Fluency",
      description: "Complete the practice set to demonstrate developing mastery in same-sign addition.",
      lessonId: "lsn_02",
      practiceSetId: "ps_integers_operations",
      dueDate: new Date(Date.now() + 86400000 * 10),
      status: "PUBLISHED",
      createdAt: new Date("2026-09-22T00:00:00Z"),
      updatedAt: new Date("2026-09-22T00:00:00Z"),
    },
  ],
};

const USERS_PERSISTENCE_FILE = path.join(process.cwd(), "data", "users-persistence.json");

export function loadPersistedUsers(): void {
  try {
    if (typeof fs !== "undefined" && fs.existsSync(USERS_PERSISTENCE_FILE)) {
      const raw = fs.readFileSync(USERS_PERSISTENCE_FILE, "utf-8");
      const savedUsers = JSON.parse(raw);
      if (Array.isArray(savedUsers)) {
        for (const u of savedUsers) {
          const idx = fallbackStore.users.findIndex(
            (existing) => existing.id === u.id || existing.email.toLowerCase() === u.email.toLowerCase()
          );
          const hydrated = {
            ...u,
            createdAt: new Date(u.createdAt || Date.now()),
            updatedAt: new Date(u.updatedAt || Date.now()),
          };
          if (idx >= 0) {
            fallbackStore.users[idx] = hydrated;
          } else {
            fallbackStore.users.push(hydrated);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not load persisted users:", err);
  }
}

export function savePersistedUsers(): void {
  try {
    if (typeof fs !== "undefined") {
      const dir = path.dirname(USERS_PERSISTENCE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(USERS_PERSISTENCE_FILE, JSON.stringify(fallbackStore.users, null, 2), "utf-8");
    }
  } catch (err) {
    console.warn("Could not save persisted users:", err);
  }
}

// Initial load on startup
// Demo/dev accounts are only loaded from disk in in-memory mode (never when a real database is configured).
if (useInMemoryAccounts) loadPersistedUsers();


// -------------------------------------------------------------
// UNIFIED DATA REPOSITORY API (Prisma with Safe Fallback)
// -------------------------------------------------------------

export const dbService = {
  /**
   * Check live database connection status safely
   */
  async getStatus(): Promise<{
    connected: boolean;
    provider: "neon-postgresql" | "in-memory-sandbox";
    details: string;
  }> {
    if (!hasValidDatabaseUrl) {
      return {
        connected: true,
        provider: "in-memory-sandbox",
        details: "Development Sandbox Store Active (Configure DATABASE_URL for Neon PostgreSQL)",
      };
    }

    try {
      await prisma.$queryRaw`SELECT 1`;
      return {
        connected: true,
        provider: "neon-postgresql",
        details: "Connected to PostgreSQL via Prisma",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        connected: false,
        provider: "neon-postgresql",
        details: `PostgreSQL connection error: ${msg}`,
      };
    }
  },

  /**
   * Get full curriculum hierarchy
   */
  async getCurriculum() {
    try {
      if (hasValidDatabaseUrl) {
        const subjects = await prisma.subject.findMany({
          include: {
            grades: {
              include: {
                terms: {
                  include: {
                    units: {
                      include: {
                        lessons: {
                          orderBy: { sequenceOrder: "asc" },
                          include: {
                            resources: true,
                            contentBlocks: true,
                            skills: {
                              include: { skill: true },
                            },
                          },
                        },
                        competencies: {
                          include: {
                            skills: {
                              orderBy: { sequenceOrder: "asc" },
                              include: { prerequisites: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (subjects.length > 0) return subjects;
      }
    } catch (error) {
      console.warn("Prisma query failed, utilizing fallback seed data:", error);
    }

    return [
      {
        ...fallbackStore.curriculum.subject,
        grades: [
          {
            ...fallbackStore.curriculum.grade,
            terms: [
              {
                ...fallbackStore.curriculum.term,
                units: [
                  {
                    ...fallbackStore.curriculum.unit,
                    lessons: fallbackStore.curriculum.lessons.sort(
                      (a, b) => a.sequenceOrder - b.sequenceOrder
                    ),
                    competencies: fallbackStore.curriculum.competencies.map((c) => ({
                      ...c,
                      skills: fallbackStore.curriculum.skills
                        .filter((s) => s.competencyId === c.id)
                        .sort((a, b) => a.sequenceOrder - b.sequenceOrder),
                    })),
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
  },

  /**
   * Get all lessons with options to filter by status or unitId
   */
  async getLessons(options?: { status?: LessonStatus; unitId?: string }) {
    try {
      if (hasValidDatabaseUrl) {
        const whereClause: any = {};
        if (options?.status) whereClause.status = options.status;
        if (options?.unitId) whereClause.unitId = options.unitId;

        const lessons = await prisma.lesson.findMany({
          where: whereClause,
          include: {
            unit: {
              include: {
                term: {
                  include: {
                    grade: {
                      include: { subject: true },
                    },
                  },
                },
              },
            },
            resources: true,
            contentBlocks: {
              orderBy: { sequenceOrder: "asc" },
            },
            skills: {
              include: { skill: true },
            },
          },
          orderBy: { sequenceOrder: "asc" },
        });
        if (lessons.length > 0) return lessons;
      }
    } catch (e) {
      console.warn("Falling back to in-memory lessons:", e);
    }

    let result = fallbackStore.curriculum.lessons;
    if (options?.status) {
      result = result.filter((l) => l.status === options.status);
    }
    if (options?.unitId) {
      result = result.filter((l) => l.unitId === options.unitId);
    }
    return result.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  },

  /**
   * Get single lesson by ID with all relations
   */
  async getLessonById(id: string) {
    try {
      if (hasValidDatabaseUrl) {
        const lesson = await prisma.lesson.findUnique({
          where: { id },
          include: {
            unit: {
              include: {
                term: {
                  include: {
                    grade: {
                      include: { subject: true },
                    },
                  },
                },
              },
            },
            resources: {
              orderBy: { sequenceOrder: "asc" },
            },
            contentBlocks: {
              orderBy: { sequenceOrder: "asc" },
            },
            skills: {
              include: {
                skill: {
                  include: {
                    prerequisites: {
                      include: { prerequisiteSkill: true },
                    },
                  },
                },
              },
            },
          },
        });
        if (lesson) return lesson;
      }
    } catch (e) {
      console.warn(`Lesson query for ${id} falling back:`, e);
    }

    const item = fallbackStore.curriculum.lessons.find((l) => l.id === id);
    if (!item) return null;

    return {
      ...item,
      unit: {
        ...fallbackStore.curriculum.unit,
        term: {
          ...fallbackStore.curriculum.term,
          grade: {
            ...fallbackStore.curriculum.grade,
            subject: fallbackStore.curriculum.subject,
          },
        },
      },
      skills: item.skillIds.map((sId) => ({
        skillId: sId,
        skill: fallbackStore.curriculum.skills.find((s) => s.id === sId),
      })),
    };
  },

  /**
   * Reorder lessons within a unit (Teacher / Admin only)
   */
  async reorderLessons(
    unitId: string,
    orderedLessonIds: string[],
    userRole: UserRole
  ): Promise<{ success: boolean; error?: string }> {
    if (userRole !== "TEACHER" && userRole !== "ADMIN") {
      return { success: false, error: "Unauthorized: Teacher or Admin privileges required." };
    }

    try {
      if (hasValidDatabaseUrl) {
        await prisma.$transaction(
          orderedLessonIds.map((id, index) =>
            prisma.lesson.update({
              where: { id },
              data: { sequenceOrder: index + 1 },
            })
          )
        );
        return { success: true };
      }
    } catch (e) {
      console.warn("reorderLessons falling back to memory:", e);
    }

    // Update in-memory sequenceOrder
    orderedLessonIds.forEach((id, index) => {
      const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === id);
      if (lesson) {
        lesson.sequenceOrder = index + 1;
      }
    });

    fallbackStore.curriculum.lessons.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    return { success: true };
  },

  /**
   * Cycle-detection validation for Skill Prerequisites
   * Returns true if adding prereqId to targetSkillId would create a circular dependency
   */
  hasCircularDependency(targetSkillId: string, candidatePrereqId: string): boolean {
    if (targetSkillId === candidatePrereqId) return true;

    const visited = new Set<string>();
    const queue = [candidatePrereqId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetSkillId) return true;

      visited.add(current);

      const skill = fallbackStore.curriculum.skills.find((s) => s.id === current);
      if (skill) {
        for (const nextPrereq of skill.prerequisiteIds) {
          if (!visited.has(nextPrereq)) {
            queue.push(nextPrereq);
          }
        }
      }
    }

    return false;
  },

  /**
   * Manage Skill Prerequisites (Teacher / Admin only)
   */
  async updateSkillPrerequisites(
    skillId: string,
    prerequisiteSkillIds: string[],
    userRole: UserRole
  ): Promise<{ success: boolean; error?: string }> {
    if (userRole !== "TEACHER" && userRole !== "ADMIN") {
      return { success: false, error: "Unauthorized: Teacher or Admin privileges required." };
    }

    const targetSkill = fallbackStore.curriculum.skills.find((s) => s.id === skillId);
    if (!targetSkill) {
      return { success: false, error: "Target skill does not exist." };
    }

    // Check for self or circular dependency
    for (const pId of prerequisiteSkillIds) {
      if (pId === skillId) {
        return { success: false, error: "A skill cannot be a prerequisite of itself." };
      }
      if (this.hasCircularDependency(skillId, pId)) {
        return {
          success: false,
          error: `Circular prerequisite dependency detected between skill and ${pId}.`,
        };
      }
    }

    try {
      if (hasValidDatabaseUrl) {
        // Delete existing prerequisites
        await prisma.skillPrerequisite.deleteMany({
          where: { skillId },
        });
        // Create new prerequisites
        await prisma.skillPrerequisite.createMany({
          data: prerequisiteSkillIds.map((prerequisiteSkillId) => ({
            skillId,
            prerequisiteSkillId,
          })),
        });
      }
    } catch (e) {
      console.warn("updateSkillPrerequisites falling back to in-memory:", e);
    }

    targetSkill.prerequisiteIds = prerequisiteSkillIds;
    return { success: true };
  },

  /**
   * Published curriculum used to build a learning path. With a database configured this reads ONLY
   * from the database (a failure throws; it never silently serves the demo curriculum). Without one
   * it uses the in-memory demo curriculum.
   */
  async loadPathCurriculum() {
    type PathLesson = {
      id: string; title: string; description?: string | null; sequenceOrder: number; estimatedMinutes: number;
      status: string; prerequisiteLessonId?: string | null; skillIds: string[]; contentBlockCount: number; resourceCount: number;
    };
    type PathSkill = { id: string; title: string; difficulty: number; prerequisiteIds: string[] };

    if (!hasValidDatabaseUrl) {
      const c = fallbackStore.curriculum;
      return {
        subject: c.subject.name as string,
        grade: c.grade.name as string,
        term: c.term.name as string,
        unit: { id: c.unit.id as string, title: c.unit.title as string, description: (c.unit.description ?? null) as string | null },
        lessons: c.lessons
          .filter((l) => l.status === "PUBLISHED")
          .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
          .map((l): PathLesson => ({
            id: l.id, title: l.title, description: l.description, sequenceOrder: l.sequenceOrder,
            estimatedMinutes: l.estimatedMinutes, status: l.status, prerequisiteLessonId: l.prerequisiteLessonId,
            skillIds: l.skillIds, contentBlockCount: l.contentBlocks?.length || 0, resourceCount: l.resources?.length || 0,
          })),
        skills: c.skills.map((sk): PathSkill => ({ id: sk.id, title: sk.title, difficulty: sk.difficulty, prerequisiteIds: sk.prerequisiteIds })),
      };
    }

    const rows = await prisma.lesson.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ sequenceOrder: "asc" }, { createdAt: "asc" }],
      include: {
        skills: { select: { skillId: true } },
        _count: { select: { contentBlocks: true, resources: true } },
        unit: { include: { term: { include: { grade: { include: { subject: true } } } } } },
      },
    });
    const skillRows = await prisma.skill.findMany({ include: { prerequisites: { select: { prerequisiteSkillId: true } } } });
    const unit = rows[0]?.unit ?? (await prisma.unit.findFirst({ orderBy: { sequenceOrder: "asc" }, include: { term: { include: { grade: { include: { subject: true } } } } } }));

    return {
      subject: unit?.term.grade.subject.name ?? "",
      grade: unit?.term.grade.name ?? "",
      term: unit?.term.name ?? "",
      unit: { id: unit?.id ?? "", title: unit?.title ?? "", description: unit?.description ?? null },
      lessons: rows.map((l): PathLesson => ({
        id: l.id, title: l.title, description: l.description, sequenceOrder: l.sequenceOrder,
        estimatedMinutes: l.estimatedMinutes, status: l.status, prerequisiteLessonId: l.prerequisiteLessonId,
        skillIds: l.skills.map((x) => x.skillId), contentBlockCount: l._count.contentBlocks, resourceCount: l._count.resources,
      })),
      skills: skillRows.map((sk): PathSkill => ({
        id: sk.id, title: sk.title, difficulty: sk.difficulty, prerequisiteIds: sk.prerequisites.map((p) => p.prerequisiteSkillId),
      })),
    };
  },

  /**
   * Retrieve Student's Complete Learning Path Progression
   */
  async getStudentLearningPath(userId: string) {
    const cur = await this.loadPathCurriculum();
    const publishedLessons = cur.lessons;

    // Get student progress
    const progressList: any[] = await this.getStudentProgress(userId);
    const progressMap = new Map<string, StudentProgressItem>();
    progressList.forEach((p: any) => {
      if (p.lessonId) progressMap.set(p.lessonId, p);
    });

    const completedLessonIds = new Set<string>();
    progressList.forEach((p: any) => {
      if (p.lessonId && (p.status === "COMPLETED" || p.progressPercentage >= 100)) {
        completedLessonIds.add(p.lessonId);
      }
    });

    // Determine state for each lesson
    const pathNodes = publishedLessons.map((lesson, idx) => {
      const prog = progressMap.get(lesson.id);
      let state: "COMPLETED" | "IN_PROGRESS" | "AVAILABLE" | "LOCKED" = "LOCKED";
      let isLocked = false;
      const lockReasons: string[] = [];

      // Check explicit lesson prerequisite if configured
      if (lesson.prerequisiteLessonId && !completedLessonIds.has(lesson.prerequisiteLessonId)) {
        const prereqLesson = publishedLessons.find((l) => l.id === lesson.prerequisiteLessonId);
        isLocked = true;
        lockReasons.push(`Requires completion of "${prereqLesson?.title || "previous lesson"}"`);
      }

      // Check skill prerequisites
      const lessonSkills = cur.skills.filter((s) => lesson.skillIds.includes(s.id));
      for (const skill of lessonSkills) {
        for (const reqSkillId of skill.prerequisiteIds) {
          const reqSkill = cur.skills.find((s) => s.id === reqSkillId);
          const skillProg = progressList.find((p) => p.skillId === reqSkillId);
          if (!skillProg || (skillProg.status !== "COMPLETED" && skillProg.progressPercentage < 100)) {
            // Check if this skill was covered in an already completed lesson
            // ...or is taught by this very lesson (a skill and its prerequisite can be taught together;
            // requiring it first would lock the lesson forever).
            const parentCompleted = publishedLessons.some(
              (pl) => pl.skillIds.includes(reqSkillId) && (pl.id === lesson.id || completedLessonIds.has(pl.id))
            );
            if (!parentCompleted) {
              isLocked = true;
              lockReasons.push(`Requires skill: ${reqSkill?.title || "Prerequisite skill"}`);
            }
          }
        }
      }

      // Also ensure sequence order: If it's the very first lesson, it's never locked by sequence
      if (idx > 0 && !isLocked) {
        const priorLesson = publishedLessons[idx - 1];
        if (!completedLessonIds.has(priorLesson.id)) {
          isLocked = true;
          lockReasons.push(`Requires completion of "${priorLesson.title}"`);
        }
      }

      if (prog?.status === "COMPLETED" || (prog?.progressPercentage || 0) >= 100) {
        state = "COMPLETED";
      } else if (prog?.status === "LEARNING" || (prog?.progressPercentage || 0) > 0) {
        state = "IN_PROGRESS";
      } else if (!isLocked) {
        state = "AVAILABLE";
      } else {
        state = "LOCKED";
      }

      return {
        lessonId: lesson.id,
        title: lesson.title,
        description: lesson.description,
        sequenceOrder: lesson.sequenceOrder,
        estimatedMinutes: lesson.estimatedMinutes,
        status: lesson.status,
        state,
        lockReasons: state === "LOCKED" ? lockReasons : [],
        progressPercentage: prog?.progressPercentage || 0,
        startedAt: prog?.startedAt,
        completedAt: prog?.completedAt,
        lastActivity: prog?.lastActivity,
        skills: lessonSkills.map((s) => ({
          id: s.id,
          title: s.title,
          difficulty: s.difficulty,
          prerequisites: s.prerequisiteIds,
        })),
        contentBlockCount: lesson.contentBlockCount,
        resourceCount: lesson.resourceCount,
      };
    });

    // Calculate Unit Progress
    const totalUnitLessons = pathNodes.length;
    const completedUnitLessons = pathNodes.filter((n) => n.state === "COMPLETED").length;
    const unitPercentage =
      totalUnitLessons > 0 ? Math.round((completedUnitLessons / totalUnitLessons) * 100) : 0;

    // Identify Continue Learning & Recommended Next
    // Continue Learning: Most recent in-progress lesson, or first available lesson
    const inProgressLesson = pathNodes.find((n) => n.state === "IN_PROGRESS");
    const firstAvailableLesson = pathNodes.find((n) => n.state === "AVAILABLE");

    const continueLearning = inProgressLesson || firstAvailableLesson || pathNodes[0] || null;

    // Next Recommended: First available or in-progress
    const nextRecommended = inProgressLesson || firstAvailableLesson || null;

    return {
      curriculum: {
        subject: cur.subject,
        grade: cur.grade,
        term: cur.term,
        unit: {
          id: cur.unit.id,
          title: cur.unit.title,
          description: cur.unit.description,
          totalLessons: totalUnitLessons,
          completedLessons: completedUnitLessons,
          progressPercentage: unitPercentage,
        },
        termProgress: {
          totalLessons: totalUnitLessons,
          completedLessons: completedUnitLessons,
          progressPercentage: unitPercentage,
        },
      },
      learningPath: pathNodes,
      continueLearning,
      nextRecommended,
    };
  },

  /**
   * Check access permission for a student to open a specific lesson
   */
  async getLessonAccess(userId: string, lessonId: string) {
    const pathData = await this.getStudentLearningPath(userId);
    const node = pathData.learningPath.find((n) => n.lessonId === lessonId);

    if (!node) {
      return {
        allowed: false,
        reason: "Lesson does not exist or has not been published to students.",
        state: "LOCKED" as const,
      };
    }

    if (node.state === "LOCKED") {
      return {
        allowed: false,
        reason:
          node.lockReasons.length > 0
            ? node.lockReasons[0]
            : "Complete the required previous lesson first.",
        state: "LOCKED" as const,
      };
    }

    return {
      allowed: true,
      state: node.state,
      node,
    };
  },

  /**
   * Which gradable questions of a lesson has this student not yet answered correctly?
   * Only well-formed questions count (a broken one cannot be answered, so it must not block completion).
   */
  async getLessonCompletionStatus(userId: string, lessonId: string) {
    const lesson: any = await this.getLessonById(lessonId);
    const required: string[] = ((lesson?.contentBlocks || []) as any[])
      .filter((b) => isGradableType(b.type) && parseChoiceBlock(b))
      .map((b) => b.id);
    const attempts: any[] = (await this.getCheckpointAttempts(userId, lessonId)) as any[];
    const correct = new Set(attempts.filter((a) => a.isCorrect).map((a) => a.blockId));
    return { required, correct: required.filter((id) => correct.has(id)), missing: required.filter((id) => !correct.has(id)) };
  },

  /**
   * Update student progress on a lesson (e.g. Started or Block completion)
   */
  async updateStudentProgress(
    userId: string,
    lessonId: string,
    payload: {
      action: "START" | "UPDATE_BLOCKS" | "COMPLETE";
      completedBlockIndex?: number;
      totalBlocks?: number;
    }
  ) {
    const now = new Date();

    // A lesson is complete only when every question in it has been answered correctly at least once.
    let missing: string[] = [];
    if (payload.action === "COMPLETE" || payload.action === "UPDATE_BLOCKS") {
      missing = (await this.getLessonCompletionStatus(userId, lessonId)).missing;
      if (payload.action === "COMPLETE" && missing.length > 0) {
        throw new LessonIncompleteError(missing);
      }
    }

    // Pure transition shared by both stores. Quality scores start at 0: they are evidence
    // fields owned by mastery/practice, never invented here.
    const apply = (prev: { status: string; progressPercentage: number; startedAt?: Date | null; completedAt?: Date | null } | null) => {
      let status = prev?.status ?? "LEARNING";
      let pct = prev?.progressPercentage ?? 15;
      let completedAt = prev?.completedAt ?? null;
      const startedAt = prev?.startedAt ?? now;
      if (payload.action === "START") {
        if (status === "NOT_STARTED") {
          status = "LEARNING";
          pct = Math.max(pct, 20);
        }
      } else if (payload.action === "UPDATE_BLOCKS") {
        const total = payload.totalBlocks || 4;
        const completed = (payload.completedBlockIndex ?? 0) + 1;
        pct = Math.max(pct, Math.min(missing.length > 0 ? 99 : 100, Math.round((completed / total) * 100)));
        if (pct >= 100) {
          status = "COMPLETED";
          completedAt = completedAt ?? now;
        } else if (status !== "COMPLETED") {
          status = "LEARNING";
        }
      } else if (payload.action === "COMPLETE") {
        status = "COMPLETED";
        pct = 100;
        completedAt = completedAt ?? now;
      }
      return { status, pct, startedAt, completedAt };
    };

    if (hasValidDatabaseUrl) {
      // One lesson-progress row per (student, lesson): the primary key is deterministic so concurrent
      // requests cannot create duplicates.
      const id = `lp:${userId}:${lessonId}`;
      const prev = await prisma.studentProgress.findUnique({ where: { id } });
      const next = apply(prev as any);
      return prisma.studentProgress.upsert({
        where: { id },
        create: {
          id, userId, lessonId, status: next.status as any, progressPercentage: next.pct,
          startedAt: next.startedAt, completedAt: next.completedAt, attemptCount: 1, lastActivity: now,
        },
        update: {
          status: next.status as any, progressPercentage: next.pct, startedAt: next.startedAt,
          completedAt: next.completedAt, lastActivity: now,
        },
      });
    }

    let prog = fallbackStore.progress.find((p) => p.userId === userId && p.lessonId === lessonId);
    const next = apply(prog ? (prog as any) : null);
    if (!prog) {
      prog = {
        id: `prg_${Date.now()}`, userId, lessonId, status: "LEARNING", progressPercentage: 15, startedAt: now,
        understandingScore: 0, accuracyScore: 0, applicationScore: 0, consistencyScore: 0, compositeScore: 0,
        attemptCount: 1, lastActivity: now,
      };
      fallbackStore.progress.push(prog);
    }
    prog.status = next.status as any;
    prog.progressPercentage = next.pct;
    prog.startedAt = next.startedAt as any;
    prog.completedAt = next.completedAt as any;
    prog.lastActivity = now;
    return prog;
  },

  /**
   * Create a new draft lesson
   */
  async createLesson(data: {
    title: string;
    description?: string;
    unitId: string;
    authorId?: string;
    learningObjectives: string[];
    estimatedMinutes?: number;
    skillIds?: string[];
  }) {
    try {
      if (hasValidDatabaseUrl) {
        const last = await prisma.lesson.aggregate({ where: { unitId: data.unitId }, _max: { sequenceOrder: true } });
        return await prisma.lesson.create({
          data: {
            title: data.title,
            description: data.description,
            unitId: data.unitId,
            authorId: data.authorId,
            sequenceOrder: (last._max.sequenceOrder ?? 0) + 1,
            status: "DRAFT",
            learningObjectives: data.learningObjectives,
            estimatedMinutes: data.estimatedMinutes || 20,
            skills: data.skillIds
              ? {
                  create: data.skillIds.map((skillId) => ({ skillId })),
                }
              : undefined,
          },
          include: {
            resources: true,
            contentBlocks: true,
            skills: { include: { skill: true } },
          },
        });
      }
    } catch (e) {
      console.warn("createLesson falling back to in-memory store:", e);
    }

    const newLesson: LessonItem = {
      id: `lsn_${Date.now()}`,
      unitId: data.unitId,
      authorId: data.authorId,
      sequenceOrder: fallbackStore.curriculum.lessons.length + 1,
      title: data.title,
      description: data.description,
      learningObjectives: data.learningObjectives,
      status: "DRAFT",
      estimatedMinutes: data.estimatedMinutes || 20,
      createdAt: new Date(),
      updatedAt: new Date(),
      resources: [],
      contentBlocks: [],
      skillIds: data.skillIds || [],
    };

    fallbackStore.curriculum.lessons.push(newLesson);
    return newLesson;
  },

  /**
   * Update an existing lesson
   */
  async updateLesson(
    id: string,
    data: {
      title?: string;
      description?: string;
      learningObjectives?: string[];
      estimatedMinutes?: number;
      prerequisiteLessonId?: string;
      contentBlocks?: Array<{
        type: BlockType;
        title?: string;
        content: string;
        sequenceOrder: number;
        metadata?: string;
      }>;
      skillIds?: string[];
    }
  ) {
    try {
      if (hasValidDatabaseUrl) {
        const updated = await prisma.lesson.update({
          where: { id },
          data: {
            title: data.title,
            description: data.description,
            learningObjectives: data.learningObjectives,
            estimatedMinutes: data.estimatedMinutes,
            prerequisiteLessonId: data.prerequisiteLessonId,
          },
          include: {
            resources: true,
            contentBlocks: true,
            skills: { include: { skill: true } },
          },
        });
        return updated;
      }
    } catch (e) {
      console.warn("updateLesson falling back to in-memory:", e);
    }

    const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === id);
    if (!lesson) throw new Error("Lesson not found");

    if (data.title !== undefined) lesson.title = data.title;
    if (data.description !== undefined) lesson.description = data.description;
    if (data.learningObjectives !== undefined)
      lesson.learningObjectives = data.learningObjectives;
    if (data.estimatedMinutes !== undefined)
      lesson.estimatedMinutes = data.estimatedMinutes;
    if (data.prerequisiteLessonId !== undefined)
      lesson.prerequisiteLessonId = data.prerequisiteLessonId;
    if (data.skillIds !== undefined) lesson.skillIds = data.skillIds;

    // Resources are intentionally NOT editable here: see addLessonDocumentResource / removeLessonResource.

    if (data.contentBlocks !== undefined) {
      lesson.contentBlocks = data.contentBlocks.map((b, i) => ({
        id: `blk_${Date.now()}_${i}`,
        lessonId: id,
        type: b.type,
        sequenceOrder: b.sequenceOrder || i + 1,
        title: b.title,
        content: b.content,
        metadata: b.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
    }

    lesson.updatedAt = new Date();
    return lesson;
  },

  /**
   * Enforce strict publishing transitions:
   * DRAFT -> REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED
   */
  async updateLessonStatus(
    id: string,
    targetStatus: LessonStatus,
    userRole: UserRole
  ): Promise<{ success: boolean; lesson?: any; error?: string }> {
    const lesson = await this.getLessonById(id);
    if (!lesson) {
      return { success: false, error: "Lesson does not exist" };
    }

    const currentStatus: LessonStatus = lesson.status;

    // Direct jump from DRAFT to PUBLISHED is forbidden
    if (currentStatus === "DRAFT" && targetStatus === "PUBLISHED") {
      return {
        success: false,
        error:
          "Invalid workflow: Lessons in DRAFT status must first be submitted for REVIEW and APPROVED before publishing.",
      };
    }

    // Role verification
    if (targetStatus === "REVIEW") {
      if (userRole !== "TEACHER" && userRole !== "ADMIN") {
        return { success: false, error: "Only teachers or administrators can submit for review" };
      }
    } else if (targetStatus === "APPROVED") {
      if (userRole !== "ADMIN" && userRole !== "TEACHER") {
        return { success: false, error: "Approval requires authorized reviewer credentials" };
      }
    } else if (targetStatus === "PUBLISHED") {
      if (userRole !== "ADMIN" && userRole !== "TEACHER") {
        return { success: false, error: "Publishing requires teacher or admin credentials" };
      }
      // Students can only be graded on questions that have a usable answer key.
      for (const b of (lesson.contentBlocks || []) as any[]) {
        if (isGradableType(b.type) && !parseChoiceBlock(b)) {
          return {
            success: false,
            error: `The ${b.type === "CHECKPOINT" ? "checkpoint" : "question"} "${b.title || "untitled"}" needs at least two different answer choices and a correct answer that is one of them before the lesson can be published.`,
          };
        }
      }
      if (currentStatus !== "APPROVED") {
        return {
          success: false,
          error: "Only lessons with APPROVED status may be PUBLISHED to students.",
        };
      }
    }

    try {
      if (hasValidDatabaseUrl) {
        const updated = await prisma.lesson.update({
          where: { id },
          data: { status: targetStatus },
        });
        return { success: true, lesson: updated };
      }
    } catch (e) {
      console.warn("updateLessonStatus falling back to in-memory:", e);
    }

    const memLesson = fallbackStore.curriculum.lessons.find((l) => l.id === id);
    if (memLesson) {
      memLesson.status = targetStatus;
      memLesson.updatedAt = new Date();
      return { success: true, lesson: memLesson };
    }

    return { success: false, error: "Failed to update status" };
  },

  /**
   * Delete a lesson
   */
  async deleteLesson(id: string, userRole: UserRole) {
    if (userRole !== "ADMIN" && userRole !== "TEACHER") {
      throw new Error("Unauthorized to delete lesson");
    }

    try {
      if (hasValidDatabaseUrl) {
        return await prisma.lesson.delete({
          where: { id },
        });
      }
    } catch (e) {
      console.warn("deleteLesson falling back to in-memory:", e);
    }

    const idx = fallbackStore.curriculum.lessons.findIndex((l) => l.id === id);
    if (idx !== -1) {
      fallbackStore.curriculum.lessons.splice(idx, 1);
      return { success: true };
    }

    throw new Error("Lesson not found");
  },

  /**
   * Get all skills
   */
  async getSkills() {
    try {
      if (hasValidDatabaseUrl) {
        const skills = await prisma.skill.findMany({
          include: {
            prerequisites: {
              include: { prerequisiteSkill: true },
            },
          },
          orderBy: { sequenceOrder: "asc" },
        });
        if (skills.length > 0) return skills;
      }
    } catch (e) {
      console.warn("Falling back to in-memory skills:", e);
    }
    return fallbackStore.curriculum.skills.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  },

  /**
   * Get single skill by ID
   */
  async getSkillById(id: string) {
    try {
      if (hasValidDatabaseUrl) {
        const skill = await prisma.skill.findUnique({
          where: { id },
          include: {
            prerequisites: {
              include: { prerequisiteSkill: true },
            },
            lessons: {
              include: { lesson: true },
            },
          },
        });
        if (skill) return skill;
      }
    } catch (e) {
      console.warn("getSkillById fallback:", e);
    }
    const skill = fallbackStore.curriculum.skills.find((s) => s.id === id);
    if (!skill) return null;
    const lessons = fallbackStore.curriculum.lessons
      .filter((l) => l.skillIds?.includes(id))
      .map((l) => ({ lessonId: l.id, lesson: l }));
    return {
      ...skill,
      lessons,
    };
  },

  /**
   * Find user by email
   */
  async findUserByEmail(email: string) {
    const cleanEmail = email.toLowerCase().trim();
    if (!useInMemoryAccounts) {
      // Database mode: the database is the only source of truth. Errors propagate (login fails closed).
      return prisma.user.findUnique({ where: { email: cleanEmail } });
    }
    return fallbackStore.users.find((u) => u.email.toLowerCase() === cleanEmail) || null;
  },


  /**
   * Find user by ID
   */
  async findUserById(id: string) {
    if (!useInMemoryAccounts) {
      return prisma.user.findUnique({ where: { id } });
    }
    return fallbackStore.users.find((u) => u.id === id) || null;
  },


  /**
   * Create new user
   */
  async createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    role: UserRole;
    gradeLevel?: number;
  }) {
    const cleanEmail = data.email.toLowerCase().trim();

    if (!useInMemoryAccounts) {
      // Database mode: DB only. Never mirrored into the in-memory store or the users JSON file.
      return prisma.user.create({
        data: {
          name: data.name,
          email: cleanEmail,
          passwordHash: data.passwordHash,
          role: data.role,
          gradeLevel: data.gradeLevel,
        },
      });
    }

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: data.name,
      email: cleanEmail,
      passwordHash: data.passwordHash,
      role: data.role,
      gradeLevel: data.gradeLevel,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    fallbackStore.users.push(newUser);
    savePersistedUsers();
    return newUser;
  },

  /** Admin user listing. Never returns password hashes. */
  async listUsers(opts: { role?: UserRole; limit?: number; offset?: number } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    const strip = (u: any) => ({ id: u.id, email: u.email, name: u.name, role: u.role, gradeLevel: u.gradeLevel ?? null, createdAt: u.createdAt });
    if (!useInMemoryAccounts) {
      const [rows, total] = await Promise.all([
        prisma.user.findMany({ where: opts.role ? { role: opts.role } : {}, orderBy: { createdAt: "desc" }, skip: offset, take: limit }),
        prisma.user.count({ where: opts.role ? { role: opts.role } : {} }),
      ]);
      return { users: rows.map(strip), total };
    }
    const all = fallbackStore.users.filter((u) => !opts.role || u.role === opts.role);
    return { users: all.slice(offset, offset + limit).map(strip), total: all.length };
  },

  async updateUserPassword(userId: string, passwordHash: string) {
    if (!useInMemoryAccounts) {
      const res = await prisma.user.updateMany({ where: { id: userId }, data: { passwordHash } });
      return res.count === 1;
    }
    const u = fallbackStore.users.find((x) => x.id === userId);
    if (!u) return false;
    u.passwordHash = passwordHash;
    u.updatedAt = new Date();
    savePersistedUsers();
    return true;
  },


  /**
   * Get student progress records
   */
  async getStudentProgress(userId: string) {
    if (hasValidDatabaseUrl) {
      // Database mode never mixes in demo progress.
      return (await prisma.studentProgress.findMany({
        where: { userId },
        include: { skill: true, lesson: true },
      })) as any;
    }
    return fallbackStore.progress.filter((p) => p.userId === userId);
  },

  // -------------------------------------------------------------
  // PHASE 5: LESSON SESSIONS & INTERACTIVE CHECKPOINT METHODS
  // -------------------------------------------------------------

  /**
   * Get active session for a student in a lesson
   */
  async getLessonSession(userId: string, lessonId: string) {
    try {
      if (hasValidDatabaseUrl) {
        const session = await prisma.lessonSession.findUnique({
          where: {
            userId_lessonId: { userId, lessonId },
          },
        });
        if (session) return session;
      }
    } catch (e) {
      console.warn("getLessonSession fallback:", e);
    }

    let session = fallbackStore.sessions.find(
      (s) => s.userId === userId && s.lessonId === lessonId
    );

    if (!session) {
      session = {
        id: `ses_${Date.now()}`,
        userId,
        lessonId,
        currentSectionIndex: 0,
        completedBlockIds: [],
        startedAt: new Date(),
        lastActivityAt: new Date(),
      };
      fallbackStore.sessions.push(session);
    }

    return session;
  },

  /**
   * Save / update lesson session state
   */
  async saveLessonSession(
    userId: string,
    lessonId: string,
    data: {
      currentSectionIndex?: number;
      completedBlockIds?: string[];
      isCompleted?: boolean;
    }
  ) {
    const now = new Date();

    try {
      if (hasValidDatabaseUrl) {
        const session = await prisma.lessonSession.upsert({
          where: {
            userId_lessonId: { userId, lessonId },
          },
          create: {
            userId,
            lessonId,
            currentSectionIndex: data.currentSectionIndex ?? 0,
            completedBlockIds: data.completedBlockIds ?? [],
            startedAt: now,
            lastActivityAt: now,
            completedAt: data.isCompleted ? now : null,
          },
          update: {
            currentSectionIndex: data.currentSectionIndex,
            completedBlockIds: data.completedBlockIds,
            lastActivityAt: now,
            completedAt: data.isCompleted ? now : undefined,
          },
        });
        return session;
      }
    } catch (e) {
      console.warn("saveLessonSession fallback:", e);
    }

    let session = fallbackStore.sessions.find(
      (s) => s.userId === userId && s.lessonId === lessonId
    );

    if (!session) {
      session = {
        id: `ses_${Date.now()}`,
        userId,
        lessonId,
        currentSectionIndex: data.currentSectionIndex ?? 0,
        completedBlockIds: data.completedBlockIds ?? [],
        startedAt: now,
        lastActivityAt: now,
        completedAt: data.isCompleted ? now : undefined,
      };
      fallbackStore.sessions.push(session);
    } else {
      if (data.currentSectionIndex !== undefined) session.currentSectionIndex = data.currentSectionIndex;
      if (data.completedBlockIds !== undefined) session.completedBlockIds = data.completedBlockIds;
      if (data.isCompleted) session.completedAt = now;
      session.lastActivityAt = now;
    }

    return session;
  },

  /**
   * Record a student's checkpoint attempt
   */
  async submitCheckpointAttempt(data: {
    userId: string;
    lessonId: string;
    blockId: string;
    answer: string;
    isCorrect: boolean;
    feedback?: string;
  }) {
    const now = new Date();

    try {
      if (hasValidDatabaseUrl) {
        const count = await prisma.checkpointAttempt.count({
          where: {
            userId: data.userId,
            lessonId: data.lessonId,
            blockId: data.blockId,
          },
        });

        const attempt = await prisma.checkpointAttempt.create({
          data: {
            userId: data.userId,
            lessonId: data.lessonId,
            blockId: data.blockId,
            attempt: count + 1,
            answer: data.answer,
            isCorrect: data.isCorrect,
            feedback: data.feedback,
            createdAt: now,
          },
        });

        // Also add to session completedBlockIds if correct
        if (data.isCorrect) {
          const session = await this.getLessonSession(data.userId, data.lessonId);
          if (session && !session.completedBlockIds.includes(data.blockId)) {
            await this.saveLessonSession(data.userId, data.lessonId, {
              completedBlockIds: [...session.completedBlockIds, data.blockId],
            });
          }
        }

        return attempt;
      }
    } catch (e) {
      console.warn("submitCheckpointAttempt fallback:", e);
    }

    const prevAttempts = fallbackStore.checkpointAttempts.filter(
      (c) => c.userId === data.userId && c.lessonId === data.lessonId && c.blockId === data.blockId
    );

    const newAttempt: CheckpointAttemptItem = {
      id: `chk_${Date.now()}`,
      userId: data.userId,
      lessonId: data.lessonId,
      blockId: data.blockId,
      attempt: prevAttempts.length + 1,
      answer: data.answer,
      isCorrect: data.isCorrect,
      feedback: data.feedback,
      createdAt: now,
    };

    fallbackStore.checkpointAttempts.push(newAttempt);

    // Like the database path: a block counts as completed only when answered correctly.
    if (data.isCorrect) {
      const session = await this.getLessonSession(data.userId, data.lessonId);
      if (session && !session.completedBlockIds.includes(data.blockId)) {
        await this.saveLessonSession(data.userId, data.lessonId, {
          completedBlockIds: [...session.completedBlockIds, data.blockId],
        });
      }
    }

    return newAttempt;
  },

  /**
   * Get all checkpoint attempts for a student on a lesson
   */
  async getCheckpointAttempts(userId: string, lessonId: string) {
    try {
      if (hasValidDatabaseUrl) {
        return await prisma.checkpointAttempt.findMany({
          where: { userId, lessonId },
          orderBy: { createdAt: "desc" },
        });
      }
    } catch (e) {
      console.warn("getCheckpointAttempts fallback:", e);
    }

    return fallbackStore.checkpointAttempts
      .filter((c) => c.userId === userId && c.lessonId === lessonId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  },

  /**
   * Add a content block to a lesson (Teacher Studio)
   */
  async addContentBlock(
    lessonId: string,
    data: {
      type: BlockType;
      title?: string;
      content: string;
      metadata?: string;
    }
  ) {
    const lesson = await this.getLessonById(lessonId);
    if (!lesson) throw new Error("Lesson not found");

    const nextOrder = (lesson.contentBlocks?.length || 0) + 1;

    try {
      if (hasValidDatabaseUrl) {
        return await prisma.lessonContentBlock.create({
          data: {
            lessonId,
            type: data.type,
            title: data.title,
            content: data.content,
            metadata: data.metadata,
            sequenceOrder: nextOrder,
          },
        });
      }
    } catch (e) {
      console.warn("addContentBlock fallback:", e);
    }

    const newBlock: LessonContentBlockItem = {
      id: `blk_${Date.now()}`,
      lessonId,
      type: data.type,
      sequenceOrder: nextOrder,
      title: data.title,
      content: data.content,
      metadata: data.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const targetLesson = fallbackStore.curriculum.lessons.find((l) => l.id === lessonId);
    if (targetLesson) {
      targetLesson.contentBlocks.push(newBlock);
    }
    return newBlock;
  },

  /**
   * Update a content block (Teacher Studio)
   */
  async updateContentBlock(
    lessonId: string,
    blockId: string,
    data: {
      type?: BlockType;
      title?: string;
      content?: string;
      metadata?: string;
    }
  ) {
    try {
      if (hasValidDatabaseUrl) {
        return await prisma.lessonContentBlock.update({
          where: { id: blockId },
          data: {
            type: data.type,
            title: data.title,
            content: data.content,
            metadata: data.metadata,
          },
        });
      }
    } catch (e) {
      console.warn("updateContentBlock fallback:", e);
    }

    const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new Error("Lesson not found");

    const block = lesson.contentBlocks.find((b) => b.id === blockId);
    if (!block) throw new Error("Content block not found");

    if (data.type) block.type = data.type;
    if (data.title !== undefined) block.title = data.title;
    if (data.content !== undefined) block.content = data.content;
    if (data.metadata !== undefined) block.metadata = data.metadata;
    block.updatedAt = new Date();

    return block;
  },

  /**
   * Delete a content block
   */
  async deleteContentBlock(lessonId: string, blockId: string) {
    try {
      if (hasValidDatabaseUrl) {
        await prisma.lessonContentBlock.delete({
          where: { id: blockId },
        });
        return { success: true };
      }
    } catch (e) {
      console.warn("deleteContentBlock fallback:", e);
    }

    const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === lessonId);
    if (!lesson) throw new Error("Lesson not found");

    const idx = lesson.contentBlocks.findIndex((b) => b.id === blockId);
    if (idx !== -1) {
      lesson.contentBlocks.splice(idx, 1);
      // Re-normalize sequence orders
      lesson.contentBlocks.forEach((b, i) => {
        b.sequenceOrder = i + 1;
      });
      return { success: true };
    }
    throw new Error("Content block not found");
  },

  /**
   * Reorder content blocks
   */
  async reorderContentBlocks(lessonId: string, orderedBlockIds: string[]) {
    try {
      if (hasValidDatabaseUrl) {
        await prisma.$transaction(
          orderedBlockIds.map((id, index) =>
            prisma.lessonContentBlock.update({
              where: { id },
              data: { sequenceOrder: index + 1 },
            })
          )
        );
        return { success: true };
      }
    } catch (e) {
      console.warn("reorderContentBlocks fallback:", e);
    }

    const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === lessonId);
    if (lesson) {
      orderedBlockIds.forEach((id, index) => {
        const block = lesson.contentBlocks.find((b) => b.id === id);
        if (block) block.sequenceOrder = index + 1;
      });
      lesson.contentBlocks.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    }
    return { success: true };
  },

  // -------------------------------------------------------------
  // PHASE 13: MATHISIPAN / YOUTUBE VIDEO RESOURCES
  // -------------------------------------------------------------

  /**
   * Attach a verified YouTube / Mathisipan educational video to a lesson
   */
  async attachLessonVideo(
    lessonId: string,
    data: {
      title: string;
      url: string;
      youtubeId: string;
      provider?: string;
      channelName?: string;
      thumbnailUrl?: string;
      description?: string;
      duration?: string;
      status?: string;
      addedBy?: string;
      notes?: string;
      metadata?: string;
    },
    userRole: string,
    userId: string
  ) {
    if (userRole !== "TEACHER" && userRole !== "ADMIN") {
      throw new Error("Forbidden: Teacher or Administrator access required to attach videos.");
    }

    const lesson = await this.getLessonById(lessonId);
    if (!lesson) throw new Error("Lesson not found");

    if (userRole !== "ADMIN" && lesson.authorId && lesson.authorId !== userId) {
      throw new Error("Forbidden: You are not authorized to modify another teacher's lesson.");
    }

    const nextOrder = (lesson.resources?.length || 0) + 1;
    const provider = data.provider || "YOUTUBE";
    const channelName = data.channelName || "Mathisipan";
    const thumbnailUrl = data.thumbnailUrl || `https://img.youtube.com/vi/${data.youtubeId}/hqdefault.jpg`;
    const status = data.status || "APPROVED";
    const addedBy = data.addedBy || userId;

    try {
      if (hasValidDatabaseUrl) {
        // Create LessonResource record and update lesson.videoUrl
        const [resource] = await prisma.$transaction([
          prisma.lessonResource.create({
            data: {
              lessonId,
              type: "YOUTUBE",
              title: data.title,
              url: data.url,
              youtubeId: data.youtubeId,
              provider,
              channelName,
              thumbnailUrl,
              description: data.description,
              duration: data.duration,
              status,
              addedBy,
              notes: data.notes || data.metadata,
              sequenceOrder: nextOrder,
            },
          }),
          prisma.lesson.update({
            where: { id: lessonId },
            data: { videoUrl: data.url },
          }),
        ]);

        return resource;
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database error attaching video resource: ${e instanceof Error ? e.message : String(e)}`);
      }
      console.warn("attachLessonVideo fallback:", e);
    }

    const newResource: LessonResourceItem = {
      id: `res_yt_${Date.now()}`,
      lessonId,
      type: "YOUTUBE",
      title: data.title,
      url: data.url,
      youtubeId: data.youtubeId,
      provider,
      channelName,
      thumbnailUrl,
      description: data.description,
      duration: data.duration,
      status,
      addedBy,
      notes: data.notes || data.metadata,
      sequenceOrder: nextOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const targetLesson = fallbackStore.curriculum.lessons.find((l) => l.id === lessonId);
    if (targetLesson) {
      targetLesson.videoUrl = data.url;
      if (!targetLesson.resources) targetLesson.resources = [];
      targetLesson.resources.push(newResource);
    }

    return newResource;
  },

  /**
   * Remove a video resource from a lesson
   */
  async removeLessonVideo(lessonId: string, resourceId: string, userRole: string, userId: string) {
    const result = await this.removeLessonResource(lessonId, resourceId, userRole, userId);
    return { success: result.success, removed: result.removed };
  },

  // -------------------------------------------------------------
  // PHASE 22: DOCUMENT RESOURCES + EXTRACTED CHUNKS
  // -------------------------------------------------------------

  /** Verify the caller may modify a lesson's resources and return the lesson. */
  async assertCanEditLesson(lessonId: string, userRole: string, userId: string) {
    if (userRole !== "TEACHER" && userRole !== "ADMIN") {
      throw new Error("Forbidden: Teacher or Administrator access required.");
    }
    const lesson = await this.getLessonById(lessonId);
    if (!lesson) throw new Error("Lesson not found");
    if (userRole !== "ADMIN" && lesson.authorId && lesson.authorId !== userId) {
      throw new Error("Forbidden: You are not authorized to modify another teacher's lesson.");
    }
    return lesson;
  },

  /**
   * Attach an uploaded document (PDF/DOCX/TXT) or teacher note to a lesson together with its extraction result.
   * Resource row and chunks are written together.
   */
  async addLessonDocumentResource(
    lessonId: string,
    userRole: string,
    userId: string,
    data: {
      type: "PDF" | "DOCUMENT" | "TEACHER_NOTE";
      title: string;
      fileName?: string;
      fileSize?: number;
      storagePath?: string;
      notes?: string;
      ingest: import("./documents/types").IngestResult;
    }
  ) {
    const lesson = await this.assertCanEditLesson(lessonId, userRole, userId);
    const nextOrder = (lesson.resources?.length || 0) + 1;
    const { ingest } = data;

    try {
      if (hasValidDatabaseUrl) {
        return await prisma.$transaction(async (tx) => {
          const resource = await tx.lessonResource.create({
            data: {
              lessonId,
              type: data.type,
              title: data.title,
              fileName: data.fileName,
              fileSize: data.fileSize,
              storagePath: data.storagePath,
              notes: data.notes,
              addedBy: userId,
              sequenceOrder: nextOrder,
              extractionStatus: ingest.status,
              extractionError: ingest.error,
              pageCount: ingest.pageCount,
              charCount: ingest.charCount,
              contentHash: ingest.contentHash,
            },
          });
          if (ingest.chunks.length > 0) {
            await tx.resourceChunk.createMany({
              data: ingest.chunks.map((c) => ({
                resourceId: resource.id,
                lessonId,
                ordinal: c.ordinal,
                text: c.text,
                sectionLabel: c.sectionLabel,
                pageStart: c.pageStart,
                pageEnd: c.pageEnd,
                isAnswerKey: c.isAnswerKey,
              })),
            });
          }
          return resource;
        });
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database error attaching document: ${e instanceof Error ? e.message : String(e)}`);
      }
      console.warn("addLessonDocumentResource fallback:", e);
    }

    const resourceId = `res_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    const resource: LessonResourceItem = {
      id: resourceId,
      lessonId,
      type: data.type as ResourceType,
      title: data.title,
      fileName: data.fileName,
      fileSize: data.fileSize,
      storagePath: data.storagePath,
      notes: data.notes,
      addedBy: userId,
      sequenceOrder: nextOrder,
      extractionStatus: ingest.status,
      extractionError: ingest.error,
      pageCount: ingest.pageCount,
      charCount: ingest.charCount,
      contentHash: ingest.contentHash,
      createdAt: now,
      updatedAt: now,
    };
    const target = fallbackStore.curriculum.lessons.find((l) => l.id === lessonId);
    if (target) {
      if (!target.resources) target.resources = [];
      target.resources.push(resource);
    }
    for (const c of ingest.chunks) {
      fallbackStore.resourceChunks.push({
        ...c,
        id: `chk_${resourceId}_${c.ordinal}`,
        resourceId,
        lessonId,
      });
    }
    return resource;
  },

  /** Remove any resource (video, document, note) from a lesson, with its chunks. Scoped to the lesson. */
  async removeLessonResource(lessonId: string, resourceId: string, userRole: string, userId: string) {
    await this.assertCanEditLesson(lessonId, userRole, userId);

    try {
      if (hasValidDatabaseUrl) {
        const existing = await prisma.lessonResource.findFirst({ where: { id: resourceId, lessonId } });
        if (!existing) return { success: false as const, removed: null };
        await prisma.lessonResource.delete({ where: { id: resourceId } }); // chunks cascade
        if (existing.type === "YOUTUBE") {
          const remainingYt = await prisma.lessonResource.count({ where: { lessonId, type: "YOUTUBE" } });
          if (remainingYt === 0) {
            await prisma.lesson.update({ where: { id: lessonId }, data: { videoUrl: null } });
          }
        }
        return { success: true as const, removed: existing as unknown as LessonResourceItem };
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        throw new Error(`Database error removing resource: ${e instanceof Error ? e.message : String(e)}`);
      }
      console.warn("removeLessonResource fallback:", e);
    }

    const target = fallbackStore.curriculum.lessons.find((l) => l.id === lessonId);
    const idx = target?.resources?.findIndex((r) => r.id === resourceId) ?? -1;
    if (!target || idx === -1) return { success: false as const, removed: null };
    const [removed] = target.resources.splice(idx, 1);
    fallbackStore.resourceChunks = fallbackStore.resourceChunks.filter((c) => c.resourceId !== resourceId);
    if (removed.type === "YOUTUBE" && !target.resources.some((r) => r.type === "YOUTUBE")) {
      target.videoUrl = undefined;
    }
    return { success: true as const, removed };
  },

  /** Chunks for a lesson, joined with their resource's title/type. Answer-key chunks are excluded by default. */
  async getLessonChunks(lessonId: string, opts: { includeAnswerKeys?: boolean } = {}) {
    type Row = import("./documents/types").StoredChunk & { resourceTitle: string; resourceType: string };
    let rows: Row[] = [];

    try {
      if (hasValidDatabaseUrl) {
        const found = await prisma.resourceChunk.findMany({
          where: { lessonId, ...(opts.includeAnswerKeys ? {} : { isAnswerKey: false }) },
          include: { resource: { select: { title: true, type: true } } },
          orderBy: [{ resourceId: "asc" }, { ordinal: "asc" }],
        });
        return found.map((c) => ({
          id: c.id,
          resourceId: c.resourceId,
          lessonId: c.lessonId,
          ordinal: c.ordinal,
          text: c.text,
          sectionLabel: c.sectionLabel,
          pageStart: c.pageStart ?? undefined,
          pageEnd: c.pageEnd ?? undefined,
          isAnswerKey: c.isAnswerKey,
          resourceTitle: c.resource.title,
          resourceType: c.resource.type as string,
        })) as Row[];
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") throw e;
      console.warn("getLessonChunks fallback:", e);
    }

    const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === lessonId);
    rows = fallbackStore.resourceChunks
      .filter((c) => c.lessonId === lessonId && (opts.includeAnswerKeys || !c.isAnswerKey))
      .map((c) => {
        const res = lesson?.resources?.find((r) => r.id === c.resourceId);
        return { ...c, resourceTitle: res?.title || "Resource", resourceType: (res?.type as string) || "DOCUMENT" };
      });
    return rows;
  },

  /**
   * Record honest video open event without fake watch percentages
   */
  async recordVideoOpenedEvent(userId: string, lessonId: string, videoId: string) {
    const session = await this.getLessonSession(userId, lessonId);
    const timestamp = new Date();

    return {
      success: true,
      event: "VIDEO_OPENED",
      userId,
      lessonId,
      videoId,
      timestamp: timestamp.toISOString(),
      sessionStarted: !!session,
    };
  },

  // -------------------------------------------------------------
  // PHASE 6: QUESTION MANAGEMENT
  // -------------------------------------------------------------

  /**
   * List questions with optional filtering
   */
  async getQuestions(filters?: {
    skillId?: string;
    lessonId?: string;
    difficulty?: QuestionDifficulty;
    status?: QuestionStatus;
    type?: QuestionType;
    search?: string;
    source?: QuestionSource;
  }) {
    try {
      if (hasValidDatabaseUrl) {
        const where: any = {};
        if (filters?.skillId) where.skillId = filters.skillId;
        if (filters?.lessonId) where.lessonId = filters.lessonId;
        if (filters?.difficulty) where.difficulty = filters.difficulty;
        if (filters?.status) where.status = filters.status;
        if (filters?.type) where.type = filters.type;
        if (filters?.source) where.source = filters.source;
        if (filters?.search) {
          where.prompt = { contains: filters.search, mode: "insensitive" };
        }

        return await prisma.question.findMany({
          where,
          include: {
            skill: true,
            lesson: true,
            createdBy: { select: { id: true, name: true, role: true } },
          },
          orderBy: { createdAt: "desc" },
        });
      }
    } catch (e) {
      console.warn("getQuestions fallback:", e);
    }

    let list = [...fallbackStore.questions];
    if (filters?.skillId) list = list.filter((q) => q.skillId === filters.skillId);
    if (filters?.lessonId) list = list.filter((q) => q.lessonId === filters.lessonId);
    if (filters?.difficulty) list = list.filter((q) => q.difficulty === filters.difficulty);
    if (filters?.status) list = list.filter((q) => q.status === filters.status);
    if (filters?.type) list = list.filter((q) => q.type === filters.type);
    if (filters?.source) list = list.filter((q) => q.source === filters.source);
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(
        (q) =>
          q.prompt.toLowerCase().includes(s) ||
          q.explanation?.toLowerCase().includes(s)
      );
    }

    // Attach skill and lesson objects
    return list.map((q) => {
      const skill = fallbackStore.curriculum.skills.find((s) => s.id === q.skillId);
      const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === q.lessonId);
      const createdBy = fallbackStore.users.find((u) => u.id === q.createdById);
      return {
        ...q,
        skill: skill ? { id: skill.id, title: skill.title } : null,
        lesson: lesson ? { id: lesson.id, title: lesson.title } : null,
        createdBy: createdBy ? { id: createdBy.id, name: createdBy.name, role: createdBy.role } : null,
      };
    });
  },

  /**
   * Get single question by ID
   */
  async getQuestionById(id: string, redactForStudent: boolean = false) {
    let question: any = null;
    try {
      if (hasValidDatabaseUrl) {
        question = await prisma.question.findUnique({
          where: { id },
          include: {
            skill: true,
            lesson: true,
            createdBy: { select: { id: true, name: true } },
          },
        });
      }
    } catch (e) {
      console.warn("getQuestionById fallback:", e);
    }

    if (!question) {
      const found = fallbackStore.questions.find((q) => q.id === id);
      if (found) {
        const skill = fallbackStore.curriculum.skills.find((s) => s.id === found.skillId);
        const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === found.lessonId);
        const createdBy = fallbackStore.users.find((u) => u.id === found.createdById);
        question = {
          ...found,
          skill: skill ? { id: skill.id, title: skill.title } : null,
          lesson: lesson ? { id: lesson.id, title: lesson.title } : null,
          createdBy: createdBy ? { id: createdBy.id, name: createdBy.name } : null,
        };
      }
    }

    if (!question) return null;

    if (redactForStudent) {
      return QuestionValidator.redactQuestionForStudent(question);
    }
    return question;
  },

  /**
   * Create question (Teacher/Admin)
   */
  async createQuestion(data: {
    lessonId?: string;
    skillId?: string;
    type: QuestionType;
    prompt: string;
    explanation?: string;
    difficulty?: QuestionDifficulty;
    status?: QuestionStatus;
    source?: QuestionSource;
    questionData: string | Record<string, any>;
    metadata?: string | Record<string, any>;
    correctFeedback?: string;
    incorrectFeedback?: string;
    allowRetry?: boolean;
    maxAttempts?: number;
  }, authorId: string) {
    const qDataStr = typeof data.questionData === "string" ? data.questionData : JSON.stringify(data.questionData || {});
    const metaStr = typeof data.metadata === "string" ? data.metadata : (data.metadata ? JSON.stringify(data.metadata) : null);

    try {
      if (hasValidDatabaseUrl) {
        return await prisma.question.create({
          data: {
            lessonId: data.lessonId || null,
            skillId: data.skillId || null,
            type: data.type,
            prompt: data.prompt,
            explanation: data.explanation || null,
            difficulty: data.difficulty || "MEDIUM",
            status: data.status || "DRAFT",
            source: data.source || "TEACHER",
            createdById: authorId,
            questionData: qDataStr,
            metadata: metaStr,
            correctFeedback: data.correctFeedback || null,
            incorrectFeedback: data.incorrectFeedback || null,
            allowRetry: data.allowRetry !== false,
            maxAttempts: data.maxAttempts || 3,
          },
        });
      }
    } catch (e) {
      console.warn("createQuestion fallback:", e);
    }

    const newQ: QuestionItem = {
      id: `qst_${Date.now()}`,
      lessonId: data.lessonId || null,
      skillId: data.skillId || null,
      type: data.type,
      prompt: data.prompt,
      explanation: data.explanation || null,
      difficulty: data.difficulty || "MEDIUM",
      status: data.status || "DRAFT",
      source: data.source || "TEACHER",
      createdById: authorId,
      questionData: qDataStr,
      metadata: metaStr,
      correctFeedback: data.correctFeedback || null,
      incorrectFeedback: data.incorrectFeedback || null,
      allowRetry: data.allowRetry !== false,
      maxAttempts: data.maxAttempts || 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    fallbackStore.questions.push(newQ);
    return newQ;
  },

  /**
   * Update question
   */
  async updateQuestion(id: string, data: any, _userId: string) {
    const qDataStr = data.questionData !== undefined
      ? (typeof data.questionData === "string" ? data.questionData : JSON.stringify(data.questionData))
      : undefined;
    const metaStr = data.metadata !== undefined
      ? (typeof data.metadata === "string" ? data.metadata : JSON.stringify(data.metadata))
      : undefined;

    try {
      if (hasValidDatabaseUrl) {
        return await prisma.question.update({
          where: { id },
          data: {
            lessonId: data.lessonId,
            skillId: data.skillId,
            type: data.type,
            prompt: data.prompt,
            explanation: data.explanation,
            difficulty: data.difficulty,
            status: data.status,
            questionData: qDataStr,
            metadata: metaStr,
            correctFeedback: data.correctFeedback,
            incorrectFeedback: data.incorrectFeedback,
            allowRetry: data.allowRetry,
            maxAttempts: data.maxAttempts,
          },
        });
      }
    } catch (e) {
      console.warn("updateQuestion fallback:", e);
    }

    const q = fallbackStore.questions.find((item) => item.id === id);
    if (!q) throw new Error("Question not found");

    if (data.lessonId !== undefined) q.lessonId = data.lessonId;
    if (data.skillId !== undefined) q.skillId = data.skillId;
    if (data.type !== undefined) q.type = data.type;
    if (data.prompt !== undefined) q.prompt = data.prompt;
    if (data.explanation !== undefined) q.explanation = data.explanation;
    if (data.difficulty !== undefined) q.difficulty = data.difficulty;
    if (data.status !== undefined) q.status = data.status;
    if (qDataStr !== undefined) q.questionData = qDataStr;
    if (metaStr !== undefined) q.metadata = metaStr;
    if (data.correctFeedback !== undefined) q.correctFeedback = data.correctFeedback;
    if (data.incorrectFeedback !== undefined) q.incorrectFeedback = data.incorrectFeedback;
    if (data.allowRetry !== undefined) q.allowRetry = Boolean(data.allowRetry);
    if (data.maxAttempts !== undefined) q.maxAttempts = Number(data.maxAttempts);
    q.updatedAt = new Date();

    return q;
  },

  /**
   * Delete question
   */
  async deleteQuestion(id: string) {
    try {
      if (hasValidDatabaseUrl) {
        await prisma.question.delete({ where: { id } });
        return { success: true };
      }
    } catch (e) {
      console.warn("deleteQuestion fallback:", e);
    }

    const idx = fallbackStore.questions.findIndex((q) => q.id === id);
    if (idx !== -1) {
      fallbackStore.questions.splice(idx, 1);
      return { success: true };
    }
    throw new Error("Question not found");
  },

  /**
   * Transition question status (DRAFT -> REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED)
   */
  async updateQuestionStatus(id: string, status: QuestionStatus, reviewerId?: string) {
    try {
      if (hasValidDatabaseUrl) {
        return await prisma.question.update({
          where: { id },
          data: {
            status,
            reviewedById: reviewerId || null,
          },
        });
      }
    } catch (e) {
      console.warn("updateQuestionStatus fallback:", e);
    }

    const q = fallbackStore.questions.find((item) => item.id === id);
    if (!q) throw new Error("Question not found");

    q.status = status;
    if (reviewerId) q.reviewedById = reviewerId;
    q.updatedAt = new Date();
    return q;
  },

  // -------------------------------------------------------------
  // PHASE 6: PRACTICE SETS
  // -------------------------------------------------------------

  /**
   * List practice sets
   */
  async getPracticeSets(filters?: {
    lessonId?: string;
    skillId?: string;
    status?: PracticeSetStatus;
  }) {
    try {
      if (hasValidDatabaseUrl) {
        const where: any = {};
        if (filters?.lessonId) where.lessonId = filters.lessonId;
        if (filters?.skillId) where.skillId = filters.skillId;
        if (filters?.status) where.status = filters.status;

        return await prisma.practiceSet.findMany({
          where,
          include: {
            lesson: { select: { id: true, title: true } },
            skill: { select: { id: true, title: true } },
            questions: {
              include: { question: true },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });
      }
    } catch (e) {
      console.warn("getPracticeSets fallback:", e);
    }

    let list = [...fallbackStore.practiceSets];
    if (filters?.lessonId) list = list.filter((ps) => ps.lessonId === filters.lessonId);
    if (filters?.skillId) list = list.filter((ps) => ps.skillId === filters.skillId);
    if (filters?.status) list = list.filter((ps) => ps.status === filters.status);

    return list.map((ps) => {
      const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === ps.lessonId);
      const skill = fallbackStore.curriculum.skills.find((s) => s.id === ps.skillId);
      const psqs = fallbackStore.practiceSetQuestions
        .filter((pq) => pq.practiceSetId === ps.id)
        .sort((a, b) => a.order - b.order);

      const questions = psqs.map((pq) => {
        const q = fallbackStore.questions.find((quest) => quest.id === pq.questionId);
        return {
          id: pq.id,
          order: pq.order,
          question: q || null,
        };
      });

      return {
        ...ps,
        lesson: lesson ? { id: lesson.id, title: lesson.title } : null,
        skill: skill ? { id: skill.id, title: skill.title } : null,
        questions,
      };
    });
  },

  /**
   * Get single practice set with ordered questions
   */
  async getPracticeSetById(id: string, redactForStudent: boolean = false) {
    let practiceSet: any = null;

    try {
      if (hasValidDatabaseUrl) {
        practiceSet = await prisma.practiceSet.findUnique({
          where: { id },
          include: {
            lesson: true,
            skill: true,
            questions: {
              include: { question: true },
              orderBy: { order: "asc" },
            },
          },
        });
      }
    } catch (e) {
      console.warn("getPracticeSetById fallback:", e);
    }

    if (!practiceSet) {
      const found = fallbackStore.practiceSets.find((ps) => ps.id === id);
      if (found) {
        const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === found.lessonId);
        const skill = fallbackStore.curriculum.skills.find((s) => s.id === found.skillId);
        const psqs = fallbackStore.practiceSetQuestions
          .filter((pq) => pq.practiceSetId === found.id)
          .sort((a, b) => a.order - b.order);

        const questions = psqs.map((pq) => {
          const q = fallbackStore.questions.find((quest) => quest.id === pq.questionId);
          return {
            id: pq.id,
            order: pq.order,
            question: q || null,
          };
        });

        practiceSet = {
          ...found,
          lesson: lesson ? { id: lesson.id, title: lesson.title } : null,
          skill: skill ? { id: skill.id, title: skill.title } : null,
          questions,
        };
      }
    }

    if (!practiceSet) return null;

    if (redactForStudent && Array.isArray(practiceSet.questions)) {
      practiceSet.questions = practiceSet.questions.map((pq: any) => ({
        ...pq,
        question: QuestionValidator.redactQuestionForStudent(pq.question),
      }));
    }

    return practiceSet;
  },

  /**
   * Create practice set
   */
  async createPracticeSet(data: {
    title: string;
    description?: string;
    lessonId?: string;
    skillId?: string;
    status?: PracticeSetStatus;
    questionIds?: string[];
  }, authorId: string) {
    const qIds = data.questionIds || [];

    try {
      if (hasValidDatabaseUrl) {
        const ps = await prisma.practiceSet.create({
          data: {
            title: data.title,
            description: data.description || null,
            lessonId: data.lessonId || null,
            skillId: data.skillId || null,
            status: data.status || "DRAFT",
            questionCount: qIds.length,
            createdById: authorId,
          },
        });

        if (qIds.length > 0) {
          await prisma.practiceSetQuestion.createMany({
            data: qIds.map((qId, idx) => ({
              practiceSetId: ps.id,
              questionId: qId,
              order: idx + 1,
            })),
          });
        }

        return this.getPracticeSetById(ps.id);
      }
    } catch (e) {
      console.warn("createPracticeSet fallback:", e);
    }

    const newPs: PracticeSetItem = {
      id: `ps_${Date.now()}`,
      title: data.title,
      description: data.description || null,
      lessonId: data.lessonId || null,
      skillId: data.skillId || null,
      status: data.status || "DRAFT",
      questionCount: qIds.length,
      createdById: authorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    fallbackStore.practiceSets.push(newPs);

    qIds.forEach((qId, idx) => {
      fallbackStore.practiceSetQuestions.push({
        id: `psq_${Date.now()}_${idx}`,
        practiceSetId: newPs.id,
        questionId: qId,
        order: idx + 1,
      });
    });

    return this.getPracticeSetById(newPs.id);
  },

  /**
   * Add a question to a practice set
   */
  async addQuestionToPracticeSet(practiceSetId: string, questionId: string, order?: number) {
    try {
      if (hasValidDatabaseUrl) {
        const count = await prisma.practiceSetQuestion.count({ where: { practiceSetId } });
        const pos = order || count + 1;
        await prisma.practiceSetQuestion.create({
          data: {
            practiceSetId,
            questionId,
            order: pos,
          },
        });
        await prisma.practiceSet.update({
          where: { id: practiceSetId },
          data: { questionCount: { increment: 1 } },
        });
        return { success: true };
      }
    } catch (e) {
      console.warn("addQuestionToPracticeSet fallback:", e);
    }

    const ps = fallbackStore.practiceSets.find((p) => p.id === practiceSetId);
    if (!ps) throw new Error("Practice set not found");

    const existing = fallbackStore.practiceSetQuestions.filter((pq) => pq.practiceSetId === practiceSetId);
    const pos = order || existing.length + 1;

    fallbackStore.practiceSetQuestions.push({
      id: `psq_${Date.now()}`,
      practiceSetId,
      questionId,
      order: pos,
    });
    ps.questionCount = existing.length + 1;
    ps.updatedAt = new Date();

    return { success: true };
  },

  /**
   * Remove question from practice set
   */
  async removeQuestionFromPracticeSet(practiceSetId: string, questionId: string) {
    try {
      if (hasValidDatabaseUrl) {
        await prisma.practiceSetQuestion.deleteMany({
          where: { practiceSetId, questionId },
        });
        const count = await prisma.practiceSetQuestion.count({ where: { practiceSetId } });
        await prisma.practiceSet.update({
          where: { id: practiceSetId },
          data: { questionCount: count },
        });
        return { success: true };
      }
    } catch (e) {
      console.warn("removeQuestionFromPracticeSet fallback:", e);
    }

    const idx = fallbackStore.practiceSetQuestions.findIndex(
      (pq) => pq.practiceSetId === practiceSetId && pq.questionId === questionId
    );
    if (idx !== -1) {
      fallbackStore.practiceSetQuestions.splice(idx, 1);
      const ps = fallbackStore.practiceSets.find((p) => p.id === practiceSetId);
      if (ps) {
        const count = fallbackStore.practiceSetQuestions.filter((pq) => pq.practiceSetId === practiceSetId).length;
        ps.questionCount = count;
        ps.updatedAt = new Date();
      }
      return { success: true };
    }
    throw new Error("Question not found in practice set");
  },

  // -------------------------------------------------------------
  // PHASE 6: PRACTICE SESSIONS & ATTEMPTS
  // -------------------------------------------------------------

  /**
   * Start a new Practice Session for a student
   */
  async startPracticeSession(studentId: string, practiceSetId: string) {
    const ps = await this.getPracticeSetById(practiceSetId, false);
    if (!ps) throw new Error("Practice set not found");
    if (ps.status !== "PUBLISHED") throw new Error("Practice set is not published");

    const questions: any[] = ps.questions || [];
    if (questions.length === 0) throw new Error("Practice set contains no questions");

    try {
      if (hasValidDatabaseUrl) {
        const session = await prisma.practiceSession.create({
          data: {
            studentId,
            practiceSetId,
            lessonId: ps.lessonId,
            skillId: ps.skillId,
            status: "IN_PROGRESS",
            totalQuestions: questions.length,
            correctAnswers: 0,
            score: 0,
          },
        });

        await prisma.practiceSessionQuestion.createMany({
          data: questions.map((q, idx) => ({
            practiceSessionId: session.id,
            questionId: q.question.id,
            order: idx + 1,
          })),
        });

        return this.getPracticeSession(session.id, studentId);
      }
    } catch (e) {
      console.warn("startPracticeSession fallback:", e);
    }

    const newSession: PracticeSessionItem = {
      id: `pses_${Date.now()}`,
      studentId,
      practiceSetId,
      lessonId: ps.lessonId,
      skillId: ps.skillId,
      status: "IN_PROGRESS",
      startedAt: new Date(),
      completedAt: null,
      score: 0,
      totalQuestions: questions.length,
      correctAnswers: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    fallbackStore.practiceSessions.push(newSession);

    questions.forEach((q, idx) => {
      fallbackStore.practiceSessionQuestions.push({
        id: `psq_${Date.now()}_${idx}`,
        practiceSessionId: newSession.id,
        questionId: q.question.id,
        order: idx + 1,
        completedAt: null,
      });
    });

    return this.getPracticeSession(newSession.id, studentId);
  },

  /**
   * Get active or completed practice session details
   */
  async getPracticeSession(sessionId: string, studentId: string) {
    let session: any = null;

    try {
      if (hasValidDatabaseUrl) {
        session = await prisma.practiceSession.findUnique({
          where: { id: sessionId },
          include: {
            practiceSet: true,
            questions: {
              include: { question: true },
              orderBy: { order: "asc" },
            },
            attempts: {
              orderBy: { submittedAt: "asc" },
            },
          },
        });
      }
    } catch (e) {
      console.warn("getPracticeSession fallback:", e);
    }

    if (!session) {
      const found = fallbackStore.practiceSessions.find((s) => s.id === sessionId);
      if (found) {
        const ps = fallbackStore.practiceSets.find((p) => p.id === found.practiceSetId);
        const psqs = fallbackStore.practiceSessionQuestions
          .filter((pq) => pq.practiceSessionId === found.id)
          .sort((a, b) => a.order - b.order);

        const questions = psqs.map((pq) => {
          const q = fallbackStore.questions.find((quest) => quest.id === pq.questionId);
          return {
            id: pq.id,
            order: pq.order,
            completedAt: pq.completedAt,
            question: q || null,
          };
        });

        const attempts = fallbackStore.questionAttempts
          .filter((a) => a.practiceSessionId === found.id)
          .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());

        session = {
          ...found,
          practiceSet: ps || null,
          questions,
          attempts,
        };
      }
    }

    if (!session) return null;
    if (session.studentId !== studentId) {
      throw new Error("Unauthorized to access this practice session");
    }

    // If session is active (not completed), redact question answers
    if (session.status !== "COMPLETED" && Array.isArray(session.questions)) {
      session.questions = session.questions.map((pq: any) => ({
        ...pq,
        question: QuestionValidator.redactQuestionForStudent(pq.question),
      }));
    }

    return session;
  },

  /**
   * Submit an answer to a question in an active practice session
   */
  async submitQuestionAnswer(params: {
    sessionId: string;
    questionId: string;
    answer: any;
    timeTakenMs?: number;
    hintUsed?: boolean;
    studentId: string;
  }) {
    const { sessionId, questionId, answer, timeTakenMs, hintUsed, studentId } = params;

    // 1. Load question (unredacted for server-side validation)
    const question = await this.getQuestionById(questionId, false);
    if (!question) throw new Error("Question not found");

    // 2. Validate session and ownership
    const session = await this.getPracticeSession(sessionId, studentId);
    if (!session) throw new Error("Practice session not found");
    if (session.status === "COMPLETED") throw new Error("Practice session already completed");

    // 3. Count prior attempts for this question in this session
    let priorAttempts: QuestionAttemptItem[] = [];
    try {
      if (hasValidDatabaseUrl) {
        priorAttempts = (await prisma.questionAttempt.findMany({
          where: { practiceSessionId: sessionId, questionId, studentId },
          orderBy: { attemptNumber: "asc" },
        })) as any;
      }
    } catch (e) {
      console.warn("count attempts fallback:", e);
    }
    if (priorAttempts.length === 0) {
      priorAttempts = fallbackStore.questionAttempts.filter(
        (a) => a.practiceSessionId === sessionId && a.questionId === questionId && a.studentId === studentId
      );
    }

    const currentAttemptNumber = priorAttempts.length + 1;
    const maxAttempts = question.maxAttempts || 3;

    if (!question.allowRetry && priorAttempts.length >= 1) {
      throw new Error("Retries are not permitted for this question.");
    }
    if (priorAttempts.length >= maxAttempts) {
      throw new Error(`Maximum attempts (${maxAttempts}) reached for this question.`);
    }

    // 4. Server-Side Answer Validation via QuestionValidator
    const validationResult = QuestionValidator.validate(
      {
        type: question.type,
        prompt: question.prompt,
        explanation: question.explanation,
        correctFeedback: question.correctFeedback,
        incorrectFeedback: question.incorrectFeedback,
        questionData: question.questionData,
      },
      answer
    );

    const answerStr = typeof answer === "string" ? answer : JSON.stringify(answer);

    // 5. Store Attempt in database
    let attemptRecord: any = null;
    try {
      if (hasValidDatabaseUrl) {
        attemptRecord = await prisma.questionAttempt.create({
          data: {
            studentId,
            questionId,
            practiceSessionId: sessionId,
            skillId: question.skillId,
            answer: answerStr,
            isCorrect: validationResult.isCorrect,
            attemptNumber: currentAttemptNumber,
            timeTakenMs: timeTakenMs || null,
            hintUsed: Boolean(hintUsed),
            submittedAt: new Date(),
          },
        });
      }
    } catch (e) {
      console.warn("create attempt fallback:", e);
    }

    if (!attemptRecord) {
      attemptRecord = {
        id: `att_${Date.now()}`,
        studentId,
        questionId,
        practiceSessionId: sessionId,
        skillId: question.skillId,
        answer: answerStr,
        isCorrect: validationResult.isCorrect,
        attemptNumber: currentAttemptNumber,
        timeTakenMs: timeTakenMs || null,
        hintUsed: Boolean(hintUsed),
        submittedAt: new Date(),
      };
      fallbackStore.questionAttempts.push(attemptRecord);
    }

    // 6. If correct or final attempt, mark question completed in session
    const isFinalOrCorrect = validationResult.isCorrect || currentAttemptNumber >= maxAttempts || !question.allowRetry;

    if (isFinalOrCorrect) {
      try {
        if (hasValidDatabaseUrl) {
          await prisma.practiceSessionQuestion.updateMany({
            where: { practiceSessionId: sessionId, questionId },
            data: { completedAt: new Date() },
          });
        }
      } catch (e) {
        console.warn("update session question fallback:", e);
      }

      const sq = fallbackStore.practiceSessionQuestions.find(
        (q) => q.practiceSessionId === sessionId && q.questionId === questionId
      );
      if (sq) sq.completedAt = new Date();
    }

    // 7. Update Session score & correct count
    const allSessionAttempts = fallbackStore.questionAttempts.filter((a) => a.practiceSessionId === sessionId);
    // Count distinct questions answered correctly
    const correctQuestionIds = new Set(
      allSessionAttempts.filter((a) => a.isCorrect).map((a) => a.questionId)
    );
    if (validationResult.isCorrect) correctQuestionIds.add(questionId);

    const totalQuestions = session.totalQuestions || 1;
    const correctCount = correctQuestionIds.size;
    const score = Math.round((correctCount / totalQuestions) * 1000) / 10;

    try {
      if (hasValidDatabaseUrl) {
        await prisma.practiceSession.update({
          where: { id: sessionId },
          data: {
            correctAnswers: correctCount,
            score,
            updatedAt: new Date(),
          },
        });
      }
    } catch (e) {
      console.warn("update session stats fallback:", e);
    }

    const sess = fallbackStore.practiceSessions.find((s) => s.id === sessionId);
    if (sess) {
      sess.correctAnswers = correctCount;
      sess.score = score;
      sess.updatedAt = new Date();
    }

    const allowRetryNext = question.allowRetry && !validationResult.isCorrect && currentAttemptNumber < maxAttempts;

    return {
      isCorrect: validationResult.isCorrect,
      feedback: validationResult.feedback,
      explanation: isFinalOrCorrect ? question.explanation : undefined,
      expectedAnswerDisplay: isFinalOrCorrect ? validationResult.expectedAnswerDisplay : undefined,
      attemptNumber: currentAttemptNumber,
      maxAttempts,
      allowRetry: allowRetryNext,
      attemptsRemaining: Math.max(0, maxAttempts - currentAttemptNumber),
      score,
      correctCount,
      totalQuestions,
    };
  },

  /**
   * Directly record a question attempt (e.g. from diagnostic/formative assessments)
   */
  async submitQuestionAttempt(params: {
    studentId: string;
    questionId: string;
    skillId?: string;
    answer: any;
    isCorrect: boolean;
    attemptNumber?: number;
    timeTakenMs?: number;
    hintUsed?: boolean;
    practiceSessionId?: string;
  }) {
    const answerStr = typeof params.answer === "string" ? params.answer : JSON.stringify(params.answer);
    let attemptRecord: any = null;
    try {
      if (hasValidDatabaseUrl) {
        attemptRecord = await prisma.questionAttempt.create({
          data: {
            studentId: params.studentId,
            questionId: params.questionId,
            skillId: params.skillId || null,
            practiceSessionId: params.practiceSessionId || null,
            answer: answerStr,
            isCorrect: params.isCorrect,
            attemptNumber: params.attemptNumber || 1,
            timeTakenMs: params.timeTakenMs || null,
            hintUsed: Boolean(params.hintUsed),
            submittedAt: new Date(),
          },
        });
      }
    } catch (e) {
      console.warn("submitQuestionAttempt fallback:", e);
    }
    if (!attemptRecord) {
      attemptRecord = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        studentId: params.studentId,
        questionId: params.questionId,
        skillId: params.skillId || "general",
        practiceSessionId: params.practiceSessionId || undefined,
        answer: answerStr,
        isCorrect: params.isCorrect,
        attemptNumber: params.attemptNumber || 1,
        timeTakenMs: params.timeTakenMs || 0,
        hintUsed: Boolean(params.hintUsed),
        submittedAt: new Date(),
      };
      fallbackStore.questionAttempts.push(attemptRecord);
    }
    return attemptRecord;
  },

  /**
   * Complete practice session
   */
  async completePracticeSession(sessionId: string, studentId: string) {
    const session = await this.getPracticeSession(sessionId, studentId);
    if (!session) throw new Error("Practice session not found");

    const now = new Date();

    try {
      if (hasValidDatabaseUrl) {
        await prisma.practiceSession.update({
          where: { id: sessionId },
          data: {
            status: "COMPLETED",
            completedAt: now,
            updatedAt: now,
          },
        });
      }
    } catch (e) {
      console.warn("completePracticeSession fallback:", e);
    }

    const sess = fallbackStore.practiceSessions.find((s) => s.id === sessionId);
    if (sess) {
      sess.status = "COMPLETED";
      sess.completedAt = now;
      sess.updatedAt = now;
    }

    // If linked to a lesson, register progress activity
    if (session.lessonId) {
      await this.updateStudentProgress(studentId, session.lessonId, { action: "START" });
    }

    return this.getPracticeSessionReview(sessionId, studentId);
  },

  /**
   * Get full review of a completed practice session
   */
  async getPracticeSessionReview(sessionId: string, studentId: string) {
    let session = await this.getPracticeSession(sessionId, studentId);
    if (!session) throw new Error("Session not found");

    // Load all full questions and student attempts
    const questions: any[] = session.questions || [];
    const attempts: any[] = session.attempts || [];

    const reviewItems = questions.map((pq: any) => {
      const q = pq.question;
      const qAttempts = attempts.filter((a: any) => a.questionId === q.id);
      const latestAttempt = qAttempts[qAttempts.length - 1] || null;

      let validationResult: any = null;
      if (latestAttempt) {
        validationResult = QuestionValidator.validate(
          {
            type: q.type,
            prompt: q.prompt,
            explanation: q.explanation,
            questionData: q.questionData,
          },
          latestAttempt.answer
        );
      }

      return {
        questionId: q.id,
        order: pq.order,
        type: q.type,
        prompt: q.prompt,
        explanation: q.explanation,
        difficulty: q.difficulty,
        attempts: qAttempts,
        latestAttempt: latestAttempt ? {
          answer: latestAttempt.answer,
          isCorrect: latestAttempt.isCorrect,
          attemptNumber: latestAttempt.attemptNumber,
          submittedAt: latestAttempt.submittedAt,
        } : null,
        expectedAnswerDisplay: validationResult?.expectedAnswerDisplay || "Configured Answer",
        isCorrect: latestAttempt?.isCorrect || false,
      };
    });

    return {
      sessionId: session.id,
      practiceSetId: session.practiceSetId,
      practiceSetTitle: session.practiceSet?.title || "Practice Activity",
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      score: session.score,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      accuracy: session.totalQuestions > 0 ? Math.round((session.correctAnswers / session.totalQuestions) * 100) : 0,
      questions: reviewItems,
    };
  },

  /**
   * Get student's past practice session history
   */
  async getStudentPracticeHistory(studentId: string) {
    try {
      if (hasValidDatabaseUrl) {
        return await prisma.practiceSession.findMany({
          where: { studentId },
          include: {
            practiceSet: { select: { id: true, title: true, description: true } },
          },
          orderBy: { startedAt: "desc" },
        });
      }
    } catch (e) {
      console.warn("getStudentPracticeHistory fallback:", e);
    }

    const sessions = fallbackStore.practiceSessions
      .filter((s) => s.studentId === studentId)
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return sessions.map((s) => {
      const ps = fallbackStore.practiceSets.find((p) => p.id === s.practiceSetId);
      return {
        ...s,
        practiceSet: ps ? { id: ps.id, title: ps.title, description: ps.description } : null,
      };
    });
  },

  // -----------------------------------------------------------
  // PHASE 7: AI TUTOR CONVERSATION & MESSAGE METHODS
  // -----------------------------------------------------------

  /**
   * Get an existing or create a new AITutorConversation
   */
  async getOrCreateAITutorConversation(params: {
    studentId: string;
    lessonId?: string | null;
    skillId?: string | null;
    questionId?: string | null;
    practiceSessionId?: string | null;
  }) {
    const { studentId, lessonId, skillId, questionId, practiceSessionId } = params;
    // A conversation is only continued while it is "live": after a long gap the student starts a fresh
    // dialogue (fresh scaffolding state) instead of resuming hours-old pedagogical state.
    const IDLE_LIMIT_MS = 3 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - IDLE_LIMIT_MS);

    try {
      if (hasValidDatabaseUrl) {
        const existing = await prisma.aITutorConversation.findFirst({
          where: {
            studentId,
            questionId: questionId || null,
            practiceSessionId: practiceSessionId || null,
            lessonId: lessonId || null,
            updatedAt: { gte: cutoff },
          },
          orderBy: { updatedAt: "desc" },
        });

        if (existing) return existing;

        return await prisma.aITutorConversation.create({
          data: {
            studentId,
            lessonId: lessonId || null,
            skillId: skillId || null,
            questionId: questionId || null,
            practiceSessionId: practiceSessionId || null,
          },
        });
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") throw e;
      console.warn("getOrCreateAITutorConversation prisma fallback:", e);
    }

    const existing = fallbackStore.aiConversations
      .filter(
        (c) =>
          c.studentId === studentId &&
          (c.questionId || null) === (questionId || null) &&
          (c.practiceSessionId || null) === (practiceSessionId || null) &&
          (c.lessonId || null) === (lessonId || null) &&
          new Date(c.updatedAt).getTime() >= cutoff.getTime()
      )
      .sort((x, y) => new Date(y.updatedAt).getTime() - new Date(x.updatedAt).getTime())[0];

    if (existing) return existing;

    const newConv = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentId,
      lessonId: lessonId || null,
      skillId: skillId || null,
      questionId: questionId || null,
      practiceSessionId: practiceSessionId || null,
      stateJson: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    fallbackStore.aiConversations.push(newConv);
    return newConv;
  },

  /**
   * Phase 23: conversations where the tutor judged the student needs the teacher (frustration, repeated
   * wrong answers, long confusion, or an explicit hand-off). Reads only the student's own conversations.
   */
  async getTutorAttentionFlags(studentId: string, limit: number = 10) {
    type Flag = {
      conversationId: string;
      lessonId: string | null;
      questionId: string | null;
      updatedAt: Date;
      reasons: string[];
      mistakePatterns: Record<string, number>;
      recentStudentMessages: string[];
      lastStrategy?: string;
    };
    const describe = (conv: { id: string; lessonId: string | null; questionId: string | null; updatedAt: Date; stateJson: string | null }): Flag | null => {
      if (!conv.stateJson) return null;
      let st: any;
      try {
        st = JSON.parse(conv.stateJson);
      } catch {
        return null;
      }
      if (!st?.needsTeacherAttention) return null;
      const reasons: string[] = [];
      if ((st.frustration ?? 0) >= 2) reasons.push("Showed repeated frustration");
      if ((st.wrongOnProblem ?? 0) >= 4) reasons.push(`${st.wrongOnProblem} wrong attempts on one problem`);
      if ((st.consecutiveConfusion ?? 0) >= 4) reasons.push(`Said they were confused ${st.consecutiveConfusion} times in a row`);
      if (st.strategyHistory?.some((h: any) => h.strategy === "SUGGEST_TEACHER")) reasons.push("The tutor suggested asking the teacher");
      if (reasons.length === 0) reasons.push("The tutor flagged this conversation");
      return {
        conversationId: conv.id,
        lessonId: conv.lessonId,
        questionId: conv.questionId,
        updatedAt: conv.updatedAt,
        reasons,
        mistakePatterns: st.diagnoses ?? {},
        recentStudentMessages: (st.recentStudentStatements ?? []).slice(-3),
        lastStrategy: st.strategyHistory?.[st.strategyHistory.length - 1]?.strategy,
      };
    };

    try {
      if (hasValidDatabaseUrl) {
        const convs = await prisma.aITutorConversation.findMany({
          where: { studentId, stateJson: { contains: '"needsTeacherAttention":true' } },
          orderBy: { updatedAt: "desc" },
          take: limit,
        });
        return convs.map(describe).filter((f): f is Flag => f !== null);
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") throw e;
      console.warn("getTutorAttentionFlags prisma fallback:", e);
    }
    return fallbackStore.aiConversations
      .filter((c) => c.studentId === studentId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map(describe)
      .filter((f): f is Flag => f !== null)
      .slice(0, limit);
  },

  /** Phase 23: persist the tutor's conversation state (strategy history, scaffold, pending problems). */
  async saveAITutorConversationState(conversationId: string, studentId: string, stateJson: string) {
    try {
      if (hasValidDatabaseUrl) {
        const res = await prisma.aITutorConversation.updateMany({
          where: { id: conversationId, studentId },
          data: { stateJson },
        });
        return res.count === 1;
      }
    } catch (e) {
      if (process.env.NODE_ENV === "production") throw e;
      console.warn("saveAITutorConversationState prisma fallback:", e);
    }
    const conv = fallbackStore.aiConversations.find((c) => c.id === conversationId && c.studentId === studentId);
    if (!conv) return false;
    conv.stateJson = stateJson;
    conv.updatedAt = new Date();
    return true;
  },

  /**
   * Get conversation by ID verifying student ownership
   */
  async getAITutorConversation(conversationId: string, studentId: string) {
    try {
      if (hasValidDatabaseUrl) {
        const conv = await prisma.aITutorConversation.findUnique({
          where: { id: conversationId },
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
            },
          },
        });
        if (!conv || conv.studentId !== studentId) return null;
        return conv;
      }
    } catch (e) {
      console.warn("getAITutorConversation prisma fallback:", e);
    }

    const conv = fallbackStore.aiConversations.find((c) => c.id === conversationId && c.studentId === studentId);
    if (!conv) return null;

    const messages = fallbackStore.aiMessages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return {
      ...conv,
      messages,
    };
  },

  /**
   * Save an AI Tutor message (either from student or tutor)
   */
  async saveAITutorMessage(params: {
    conversationId: string;
    role: "STUDENT" | "TUTOR" | "SYSTEM";
    content: string;
    messageType?: "QUESTION" | "HINT" | "GUIDING_QUESTION" | "EXPLANATION" | "EXAMPLE" | "FEEDBACK" | "CLARIFICATION" | "REDIRECT";
    hintLevel?: number | null;
    guidingQuestion?: string | null;
    metadata?: string | null;
  }) {
    const { conversationId, role, content, messageType = "HINT", hintLevel, guidingQuestion, metadata } = params;

    try {
      if (hasValidDatabaseUrl) {
        return await prisma.aITutorMessage.create({
          data: {
            conversationId,
            role,
            content,
            messageType,
            hintLevel: hintLevel || null,
            guidingQuestion: guidingQuestion || null,
            metadata: metadata || null,
          },
        });
      }
    } catch (e) {
      console.warn("saveAITutorMessage prisma fallback:", e);
    }

    const newMsg = {
      id: `aimsg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversationId,
      role,
      content,
      messageType,
      hintLevel: hintLevel || null,
      guidingQuestion: guidingQuestion || null,
      metadata: metadata || null,
      createdAt: new Date(),
    };

    fallbackStore.aiMessages.push(newMsg);

    // Update conversation updatedAt
    const conv = fallbackStore.aiConversations.find((c) => c.id === conversationId);
    if (conv) conv.updatedAt = new Date();

    return newMsg;
  },

  /**
   * Get messages for a conversation
   */
  async getAITutorMessages(conversationId: string, limit: number = 20) {
    try {
      if (hasValidDatabaseUrl) {
        // Latest N messages (oldest first). Ordering ascending with `take` would return the FIRST N forever.
        const latest = await prisma.aITutorMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        return latest.reverse();
      }
    } catch (e) {
      console.warn("getAITutorMessages prisma fallback:", e);
    }

    return fallbackStore.aiMessages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-limit);
  },

  /**
   * Get previous attempts for a student on a specific question
   */
  async getQuestionAttemptsForStudent(studentId: string, questionId: string, practiceSessionId?: string | null) {
    try {
      if (hasValidDatabaseUrl) {
        return await prisma.questionAttempt.findMany({
          where: {
            studentId,
            questionId,
            ...(practiceSessionId ? { practiceSessionId } : {}),
          },
          orderBy: { attemptNumber: "asc" },
        });
      }
    } catch (e) {
      console.warn("getQuestionAttemptsForStudent prisma fallback:", e);
    }

    return fallbackStore.questionAttempts
      .filter(
        (a) =>
          a.studentId === studentId &&
          a.questionId === questionId &&
          (practiceSessionId ? a.practiceSessionId === practiceSessionId : true)
      )
      .sort((a, b) => a.attemptNumber - b.attemptNumber);
  },

  /**
   * Mark hintUsed = true on question attempts for research analytics
   */
  async markHintUsedOnQuestionAttempt(studentId: string, questionId: string, practiceSessionId?: string | null) {
    try {
      if (hasValidDatabaseUrl) {
        await prisma.questionAttempt.updateMany({
          where: {
            studentId,
            questionId,
            ...(practiceSessionId ? { practiceSessionId } : {}),
          },
          data: {
            hintUsed: true,
          },
        });
        return;
      }
    } catch (e) {
      console.warn("markHintUsedOnQuestionAttempt prisma fallback:", e);
    }

    fallbackStore.questionAttempts.forEach((a) => {
      if (
        a.studentId === studentId &&
        a.questionId === questionId &&
        (!practiceSessionId || a.practiceSessionId === practiceSessionId)
      ) {
        a.hintUsed = true;
      }
    });
  },

  /**
   * Get teacher AI settings
   */
  async getTeacherAISettings() {
    return fallbackStore.teacherAISettings;
  },

  /**
   * Update teacher AI settings
   */
  async updateTeacherAISettings(settings: Partial<typeof fallbackStore.teacherAISettings>) {
    fallbackStore.teacherAISettings = {
      ...fallbackStore.teacherAISettings,
      ...settings,
    };
    return fallbackStore.teacherAISettings;
  },

  // -----------------------------------------------------------
  // PHASE 8: AI MISTAKE ANALYZER DATA METHODS
  // -----------------------------------------------------------

  /**
   * Get detailed student question attempts joined with full question data
   */
  async getDetailedAttemptsForStudent(params: {
    studentId: string;
    skillId?: string | null;
    lessonId?: string | null;
    practiceSessionId?: string | null;
    limit?: number;
  }) {
    const { studentId, skillId, lessonId, practiceSessionId, limit = 10 } = params;

    try {
      if (hasValidDatabaseUrl) {
        const attempts = await prisma.questionAttempt.findMany({
          where: {
            studentId,
            ...(skillId ? { skillId } : {}),
            ...(practiceSessionId ? { practiceSessionId } : {}),
            ...(lessonId && !practiceSessionId
              ? { question: { lessonId } }
              : {}),
          },
          include: {
            question: true,
          },
          orderBy: { submittedAt: "desc" },
          take: limit,
        });

        // Return chronological order (oldest to newest)
        return attempts.reverse().map((a: any) => ({
          ...a,
          submittedAt: a.submittedAt.toISOString(),
          question: {
            id: a.question.id,
            type: a.question.type,
            prompt: a.question.prompt,
            difficulty: a.question.difficulty,
            explanation: a.question.explanation,
            questionData: a.question.questionData,
            correctFeedback: a.question.correctFeedback,
            incorrectFeedback: a.question.incorrectFeedback,
          },
        }));
      }
    } catch (e) {
      console.warn("getDetailedAttemptsForStudent fallback:", e);
    }

    // Fallback store lookup
    let filtered = fallbackStore.questionAttempts.filter((a) => {
      if (a.studentId !== studentId) return false;
      if (practiceSessionId && a.practiceSessionId !== practiceSessionId) return false;
      if (skillId && a.skillId !== skillId) return false;
      return true;
    });

    if (lessonId && !practiceSessionId) {
      filtered = filtered.filter((a) => {
        const q = fallbackStore.questions.find((quest) => quest.id === a.questionId);
        return q && q.lessonId === lessonId;
      });
    }

    filtered.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    const sliced = filtered.slice(0, limit).reverse();

    return sliced.map((a) => {
      const q = fallbackStore.questions.find((quest) => quest.id === a.questionId) || {
        id: a.questionId,
        type: "MULTIPLE_CHOICE",
        prompt: "Sample math prompt",
        difficulty: "MEDIUM",
        explanation: null,
        questionData: null,
        correctFeedback: null,
        incorrectFeedback: null,
      };

      return {
        id: a.id,
        studentId: a.studentId,
        questionId: a.questionId,
        practiceSessionId: a.practiceSessionId,
        skillId: a.skillId,
        answer: a.answer,
        isCorrect: a.isCorrect,
        attemptNumber: a.attemptNumber,
        timeTakenMs: a.timeTakenMs,
        hintUsed: a.hintUsed,
        submittedAt: a.submittedAt.toISOString(),
        question: {
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          difficulty: q.difficulty,
          explanation: q.explanation,
          questionData: q.questionData,
          correctFeedback: q.correctFeedback,
          incorrectFeedback: q.incorrectFeedback,
        },
      };
    });
  },

  /**
   * Get student's accuracy on prerequisite skills of a given target skill
   */
  async getPrerequisitePerformance(studentId: string, skillId: string) {
    const skills: any[] = await this.getSkills();
    const targetSkill = skills.find((s: any) => s.id === skillId);
    if (!targetSkill) {
      return [];
    }

    let pIds: string[] = [];
    if (Array.isArray(targetSkill.prerequisiteIds)) {
      pIds = targetSkill.prerequisiteIds;
    } else if (Array.isArray(targetSkill.prerequisites)) {
      pIds = targetSkill.prerequisites.map((p: any) => p.prerequisiteSkillId || p.id);
    }

    if (pIds.length === 0) return [];

    const prereqResults: Array<{ skillId: string; title: string; accuracy: number; totalAttempts: number }> = [];

    for (const pId of pIds) {
      const prereqSkill = skills.find((s: any) => s.id === pId);
      if (!prereqSkill) continue;

      let pAttempts: any[] = [];
      try {
        if (hasValidDatabaseUrl) {
          pAttempts = await prisma.questionAttempt.findMany({
            where: { studentId, skillId: pId },
            select: { isCorrect: true },
          });
        } else {
          pAttempts = fallbackStore.questionAttempts.filter((a) => a.studentId === studentId && a.skillId === pId);
        }
      } catch {
        pAttempts = fallbackStore.questionAttempts.filter((a) => a.studentId === studentId && a.skillId === pId);
      }

      if (pAttempts.length > 0) {
        const correct = pAttempts.filter((a) => a.isCorrect).length;
        const accuracy = Math.round((correct / pAttempts.length) * 100);
        prereqResults.push({
          skillId: pId,
          title: prereqSkill.title,
          accuracy,
          totalAttempts: pAttempts.length,
        });
      }
    }

    return prereqResults;
  },

  /**
   * Save a generated MistakeAnalysis and its evidence relationships
   */
  async saveMistakeAnalysis(data: {
    studentId: string;
    skillId?: string | null;
    lessonId?: string | null;
    practiceSessionId?: string | null;
    category: any;
    observation: string;
    pattern: string;
    possibleCause?: string | null;
    confidence: number;
    recommendation: string;
    evidenceSummary?: string | null;
    status?: any;
    trigger?: any;
    analyzerVersion?: string;
    metadata?: string | null;
    evidenceAttemptIds: string[];
  }) {
    const {
      studentId,
      skillId,
      lessonId,
      practiceSessionId,
      category,
      observation,
      pattern,
      possibleCause,
      confidence,
      recommendation,
      evidenceSummary,
      status = "COMPLETED",
      trigger = "PRACTICE_COMPLETED",
      analyzerVersion = "1.0",
      metadata,
      evidenceAttemptIds,
    } = data;

    try {
      if (hasValidDatabaseUrl) {
        // Mark previous active analyses for this student + skill as OUTDATED
        if (skillId) {
          await prisma.mistakeAnalysis.updateMany({
            where: { studentId, skillId, status: "COMPLETED" },
            data: { status: "OUTDATED" },
          });
        }

        const analysis = await prisma.mistakeAnalysis.create({
          data: {
            studentId,
            skillId: skillId || null,
            lessonId: lessonId || null,
            practiceSessionId: practiceSessionId || null,
            category,
            observation,
            pattern,
            possibleCause: possibleCause || null,
            confidence,
            recommendation,
            evidenceSummary: evidenceSummary || null,
            status,
            trigger,
            analyzerVersion,
            metadata: metadata || null,
          },
        });

        // Create evidence linkages
        if (evidenceAttemptIds && evidenceAttemptIds.length > 0) {
          for (const attemptId of evidenceAttemptIds) {
            try {
              await prisma.mistakeAnalysisEvidence.create({
                data: {
                  analysisId: analysis.id,
                  attemptId,
                  relevanceScore: 1.0,
                },
              });
            } catch {
              // ignore duplicate evidence link
            }
          }
        }

        return this.getMistakeAnalysisById(analysis.id, studentId, "STUDENT");
      }
    } catch (e) {
      console.warn("saveMistakeAnalysis prisma fallback:", e);
    }

    // Mark previous fallback analyses as OUTDATED
    if (skillId) {
      fallbackStore.mistakeAnalyses.forEach((a) => {
        if (a.studentId === studentId && a.skillId === skillId && a.status === "COMPLETED") {
          a.status = "OUTDATED";
        }
      });
    }

    const newAnalysisId = `mana_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newAnalysis = {
      id: newAnalysisId,
      studentId,
      skillId: skillId || null,
      lessonId: lessonId || null,
      practiceSessionId: practiceSessionId || null,
      category,
      observation,
      pattern,
      possibleCause: possibleCause || null,
      confidence,
      recommendation,
      evidenceSummary: evidenceSummary || null,
      status,
      trigger,
      analyzerVersion,
      metadata: metadata || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    fallbackStore.mistakeAnalyses.push(newAnalysis);

    if (evidenceAttemptIds && evidenceAttemptIds.length > 0) {
      evidenceAttemptIds.forEach((attId) => {
        fallbackStore.mistakeAnalysisEvidences.push({
          id: `mev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          analysisId: newAnalysisId,
          attemptId: attId,
          relevanceScore: 1.0,
          notes: null,
          createdAt: new Date(),
        });
      });
    }

    return this.getMistakeAnalysisById(newAnalysisId, studentId, "STUDENT");
  },

  /**
   * Get mistake analyses for a student with evidence details
   */
  async getMistakeAnalysesForStudent(
    studentId: string,
    options?: { skillId?: string; limit?: number; includeOutdated?: boolean }
  ) {
    const { skillId, limit = 20, includeOutdated = false } = options || {};

    try {
      if (hasValidDatabaseUrl) {
        const list = await prisma.mistakeAnalysis.findMany({
          where: {
            studentId,
            ...(skillId ? { skillId } : {}),
            ...(!includeOutdated ? { status: { in: ["COMPLETED", "PENDING"] } } : {}),
          },
          include: {
            skill: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
            evidences: {
              include: {
                attempt: {
                  include: { question: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });

        return list.map((a: any) => ({
          ...a,
          skillTitle: a.skill?.title || null,
          lessonTitle: a.lesson?.title || null,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
          evidences: a.evidences.map((e: any) => ({
            attemptId: e.attempt.id,
            questionId: e.attempt.question.id,
            questionPrompt: e.attempt.question.prompt,
            questionType: e.attempt.question.type,
            difficulty: e.attempt.question.difficulty,
            studentAnswer: e.attempt.answer,
            isCorrect: e.attempt.isCorrect,
            attemptNumber: e.attempt.attemptNumber,
            timeTakenMs: e.attempt.timeTakenMs,
            submittedAt: e.attempt.submittedAt.toISOString(),
          })),
        }));
      }
    } catch (e) {
      console.warn("getMistakeAnalysesForStudent prisma fallback:", e);
    }

    let analyses = fallbackStore.mistakeAnalyses.filter((a) => {
      if (a.studentId !== studentId) return false;
      if (skillId && a.skillId !== skillId) return false;
      if (!includeOutdated && a.status === "OUTDATED") return false;
      return true;
    });

    analyses.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const sliced = analyses.slice(0, limit);

    return sliced.map((a) => {
      const skill = fallbackStore.curriculum.skills.find((s) => s.id === a.skillId);
      const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === a.lessonId);
      const student = fallbackStore.users.find((u) => u.id === a.studentId);

      const evs = fallbackStore.mistakeAnalysisEvidences.filter((e) => e.analysisId === a.id);
      const evidences = evs.map((e) => {
        const att = fallbackStore.questionAttempts.find((att) => att.id === e.attemptId);
        const q = att ? fallbackStore.questions.find((quest) => quest.id === att.questionId) : null;

        return {
          attemptId: e.attemptId,
          questionId: q?.id || "unknown",
          questionPrompt: q?.prompt || "Sample prompt",
          questionType: q?.type || "MULTIPLE_CHOICE",
          difficulty: q?.difficulty || "MEDIUM",
          studentAnswer: att?.answer || "",
          isCorrect: att?.isCorrect || false,
          attemptNumber: att?.attemptNumber || 1,
          timeTakenMs: att?.timeTakenMs || null,
          submittedAt: att ? att.submittedAt.toISOString() : new Date().toISOString(),
        };
      });

      return {
        ...a,
        studentName: student?.name || "Student",
        skillTitle: skill?.title || null,
        lessonTitle: lesson?.title || null,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        evidences,
      };
    });
  },

  /**
   * Get single analysis with full evidence verification
   */
  async getMistakeAnalysisById(analysisId: string, requesterId: string, requesterRole: string) {
    try {
      if (hasValidDatabaseUrl) {
        const analysis = await prisma.mistakeAnalysis.findUnique({
          where: { id: analysisId },
          include: {
            student: { select: { id: true, name: true, email: true } },
            skill: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
            evidences: {
              include: {
                attempt: {
                  include: { question: true },
                },
              },
            },
          },
        });

        if (!analysis) return null;

        // Security check: Only the student themselves or a TEACHER/ADMIN can inspect
        if (requesterRole === "STUDENT" && analysis.studentId !== requesterId) {
          return null;
        }

        return {
          ...analysis,
          studentName: analysis.student.name,
          skillTitle: analysis.skill?.title || null,
          lessonTitle: analysis.lesson?.title || null,
          createdAt: analysis.createdAt.toISOString(),
          updatedAt: analysis.updatedAt.toISOString(),
          evidences: analysis.evidences.map((e: any) => ({
            attemptId: e.attempt.id,
            questionId: e.attempt.question.id,
            questionPrompt: e.attempt.question.prompt,
            questionType: e.attempt.question.type,
            difficulty: e.attempt.question.difficulty,
            studentAnswer: e.attempt.answer,
            isCorrect: e.attempt.isCorrect,
            attemptNumber: e.attempt.attemptNumber,
            timeTakenMs: e.attempt.timeTakenMs,
            submittedAt: e.attempt.submittedAt.toISOString(),
          })),
        };
      }
    } catch (e) {
      console.warn("getMistakeAnalysisById prisma fallback:", e);
    }

    const a = fallbackStore.mistakeAnalyses.find((item) => item.id === analysisId);
    if (!a) return null;

    if (requesterRole === "STUDENT" && a.studentId !== requesterId) {
      return null;
    }

    const skill = fallbackStore.curriculum.skills.find((s) => s.id === a.skillId);
    const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === a.lessonId);
    const student = fallbackStore.users.find((u) => u.id === a.studentId);

    const evs = fallbackStore.mistakeAnalysisEvidences.filter((e) => e.analysisId === a.id);
    const evidences = evs.map((e) => {
      const att = fallbackStore.questionAttempts.find((att) => att.id === e.attemptId);
      const q = att ? fallbackStore.questions.find((quest) => quest.id === att.questionId) : null;

      return {
        attemptId: e.attemptId,
        questionId: q?.id || "unknown",
        questionPrompt: q?.prompt || "Sample prompt",
        questionType: q?.type || "MULTIPLE_CHOICE",
        difficulty: q?.difficulty || "MEDIUM",
        studentAnswer: att?.answer || "",
        isCorrect: att?.isCorrect || false,
        attemptNumber: att?.attemptNumber || 1,
        timeTakenMs: att?.timeTakenMs || null,
        submittedAt: att ? att.submittedAt.toISOString() : new Date().toISOString(),
      };
    });

    return {
      ...a,
      studentName: student?.name || "Student",
      skillTitle: skill?.title || null,
      lessonTitle: lesson?.title || null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      evidences,
    };
  },

  /**
   * Get latest completed mistake analysis for a specific student and skill
   */
  async getLatestMistakeAnalysisForSkill(studentId: string, skillId: string) {
    try {
      if (hasValidDatabaseUrl) {
        const item = await prisma.mistakeAnalysis.findFirst({
          where: { studentId, skillId, status: "COMPLETED" },
          orderBy: { createdAt: "desc" },
          include: {
            skill: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
          },
        });
        if (item) {
          return {
            ...item,
            skillTitle: item.skill?.title || null,
            lessonTitle: item.lesson?.title || null,
            createdAt: item.createdAt.toISOString(),
            updatedAt: item.updatedAt.toISOString(),
          };
        }
      }
    } catch (e) {
      console.warn("getLatestMistakeAnalysisForSkill prisma fallback:", e);
    }

    const item = fallbackStore.mistakeAnalyses
      .filter((a) => a.studentId === studentId && a.skillId === skillId && a.status === "COMPLETED")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    if (!item) return null;

    const skill = fallbackStore.curriculum.skills.find((s) => s.id === item.skillId);
    const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === item.lessonId);

    return {
      ...item,
      skillTitle: skill?.title || null,
      lessonTitle: lesson?.title || null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  },

  // -------------------------------------------------------------
  // PHASE 9: ADAPTIVE LEARNING ENGINE REPOSITORY METHODS
  // -------------------------------------------------------------

  /**
   * Get DAG prerequisites for a skill
   */
  async getSkillPrerequisites(skillId: string): Promise<Array<{ prerequisiteSkillId: string; prerequisiteSkillTitle: string }>> {
    try {
      if (hasValidDatabaseUrl) {
        const prereqs = await prisma.skillPrerequisite.findMany({
          where: { skillId },
          include: {
            prerequisiteSkill: { select: { id: true, title: true } },
          },
        });
        if (prereqs && prereqs.length > 0) {
          return prereqs.map((p) => ({
            prerequisiteSkillId: p.prerequisiteSkillId,
            prerequisiteSkillTitle: p.prerequisiteSkill?.title || "Prerequisite Skill",
          }));
        }
      }
    } catch (e) {
      console.warn("getSkillPrerequisites prisma fallback:", e);
    }

    const skills: any[] = fallbackStore.curriculum.skills;
    const target = skills.find((s) => s.id === skillId);
    if (!target) return [];

    let pIds: string[] = [];
    if (Array.isArray(target.prerequisiteIds)) {
      pIds = target.prerequisiteIds;
    } else if (Array.isArray(target.prerequisites)) {
      pIds = target.prerequisites.map((p: any) => p.prerequisiteSkillId || p.id);
    }

    return pIds.map((pid) => {
      const ps = skills.find((s) => s.id === pid);
      return {
        prerequisiteSkillId: pid,
        prerequisiteSkillTitle: ps?.title || "Prerequisite Skill",
      };
    });
  },

  /**
   * Get active adaptive recommendation for a student (and optionally skill)
   */
  async getActiveAdaptiveRecommendation(studentId: string, skillId?: string) {
    try {
      if (hasValidDatabaseUrl) {
        const rec = await prisma.adaptiveRecommendation.findFirst({
          where: {
            studentId,
            status: "ACTIVE",
            ...(skillId ? { skillId } : {}),
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
          orderBy: { createdAt: "desc" },
          include: {
            student: { select: { id: true, name: true, email: true } },
            skill: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
            overrides: {
              include: {
                teacher: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        });
        if (rec) return rec;
      }
    } catch (e) {
      console.warn("getActiveAdaptiveRecommendation prisma fallback:", e);
    }

    const now = new Date();
    const rec = (fallbackStore.adaptiveRecommendations || [])
      .filter(
        (r) =>
          r.studentId === studentId &&
          r.status === "ACTIVE" &&
          (!skillId || r.skillId === skillId) &&
          (!r.expiresAt || new Date(r.expiresAt) > now)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!rec) return null;

    const student = fallbackStore.users.find((u) => u.id === rec.studentId);
    const skill = fallbackStore.curriculum.skills.find((s) => s.id === rec.skillId);
    const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === rec.lessonId);
    const overrides = (fallbackStore.adaptiveRecommendationOverrides || [])
      .filter((o) => o.recommendationId === rec.id)
      .map((o) => {
        const teacher = fallbackStore.users.find((u) => u.id === o.teacherId);
        return { ...o, teacher: teacher ? { id: teacher.id, name: teacher.name } : null };
      });

    return {
      ...rec,
      student: student ? { id: student.id, name: student.name, email: student.email } : null,
      skill: skill ? { id: skill.id, title: skill.title } : null,
      lesson: lesson ? { id: lesson.id, title: lesson.title } : null,
      overrides,
    };
  },

  /**
   * Get recommendation by ID
   */
  async getAdaptiveRecommendationById(id: string) {
    try {
      if (hasValidDatabaseUrl) {
        const rec = await prisma.adaptiveRecommendation.findUnique({
          where: { id },
          include: {
            student: { select: { id: true, name: true, email: true } },
            skill: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
            overrides: {
              include: {
                teacher: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        });
        if (rec) return rec;
      }
    } catch (e) {
      console.warn("getAdaptiveRecommendationById prisma fallback:", e);
    }

    const rec = (fallbackStore.adaptiveRecommendations || []).find((r) => r.id === id);
    if (!rec) return null;

    const student = fallbackStore.users.find((u) => u.id === rec.studentId);
    const skill = fallbackStore.curriculum.skills.find((s) => s.id === rec.skillId);
    const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === rec.lessonId);
    const overrides = (fallbackStore.adaptiveRecommendationOverrides || [])
      .filter((o) => o.recommendationId === rec.id)
      .map((o) => {
        const teacher = fallbackStore.users.find((u) => u.id === o.teacherId);
        return { ...o, teacher: teacher ? { id: teacher.id, name: teacher.name } : null };
      });

    return {
      ...rec,
      student: student ? { id: student.id, name: student.name, email: student.email } : null,
      skill: skill ? { id: skill.id, title: skill.title } : null,
      lesson: lesson ? { id: lesson.id, title: lesson.title } : null,
      overrides,
    };
  },

  /**
   * Create an adaptive recommendation
   */
  async createAdaptiveRecommendation(payload: any) {
    const id = `adrec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    try {
      if (hasValidDatabaseUrl) {
        const rec = await prisma.adaptiveRecommendation.create({
          data: {
            id,
            studentId: payload.studentId,
            skillId: payload.skillId || null,
            lessonId: payload.lessonId || null,
            decisionType: payload.decisionType,
            reason: payload.reason,
            evidenceSummary: payload.evidenceSummary || null,
            confidence: payload.confidence || "MEDIUM",
            recommendedActivityType: payload.recommendedActivityType,
            recommendedActivityId: payload.recommendedActivityId || null,
            source: payload.source || "RULE_ENGINE",
            status: payload.status || "ACTIVE",
            targetDifficulty: payload.targetDifficulty || null,
            metadata: payload.metadata || null,
            expiresAt: payload.expiresAt || null,
          },
          include: {
            student: { select: { id: true, name: true, email: true } },
            skill: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
            overrides: true,
          },
        });
        return rec;
      }
    } catch (e) {
      console.warn("createAdaptiveRecommendation prisma fallback:", e);
    }

    const newRecord = {
      id,
      studentId: payload.studentId,
      skillId: payload.skillId || null,
      lessonId: payload.lessonId || null,
      decisionType: payload.decisionType,
      reason: payload.reason,
      evidenceSummary: payload.evidenceSummary || null,
      confidence: payload.confidence || "MEDIUM",
      recommendedActivityType: payload.recommendedActivityType,
      recommendedActivityId: payload.recommendedActivityId || null,
      source: payload.source || "RULE_ENGINE",
      status: payload.status || "ACTIVE",
      targetDifficulty: payload.targetDifficulty || null,
      metadata: payload.metadata || null,
      createdAt: now,
      updatedAt: now,
      expiresAt: payload.expiresAt || null,
    };

    if (!fallbackStore.adaptiveRecommendations) {
      fallbackStore.adaptiveRecommendations = [];
    }
    fallbackStore.adaptiveRecommendations.unshift(newRecord);
    return this.getAdaptiveRecommendationById(id);
  },

  /**
   * Mark previous active recommendations as SUPERSEDED
   */
  async supersedeActiveRecommendations(studentId: string, skillId?: string) {
    try {
      if (hasValidDatabaseUrl) {
        await prisma.adaptiveRecommendation.updateMany({
          where: {
            studentId,
            status: "ACTIVE",
            ...(skillId ? { skillId } : {}),
          },
          data: {
            status: "SUPERSEDED",
            updatedAt: new Date(),
          },
        });
        return;
      }
    } catch (e) {
      console.warn("supersedeActiveRecommendations prisma fallback:", e);
    }

    (fallbackStore.adaptiveRecommendations || []).forEach((r) => {
      if (r.studentId === studentId && r.status === "ACTIVE" && (!skillId || r.skillId === skillId)) {
        r.status = "SUPERSEDED";
        r.updatedAt = new Date();
      }
    });
  },

  /**
   * Update recommendation status (e.g. COMPLETED, DISMISSED)
   */
  async updateAdaptiveRecommendationStatus(id: string, studentId: string, status: any) {
    try {
      if (hasValidDatabaseUrl) {
        const updated = await prisma.adaptiveRecommendation.update({
          where: { id },
          data: {
            status,
            updatedAt: new Date(),
          },
          include: {
            student: { select: { id: true, name: true, email: true } },
            skill: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
            overrides: true,
          },
        });
        return updated;
      }
    } catch (e) {
      console.warn("updateAdaptiveRecommendationStatus prisma fallback:", e);
    }

    const rec = (fallbackStore.adaptiveRecommendations || []).find(
      (r) => r.id === id && r.studentId === studentId
    );
    if (!rec) return null;

    rec.status = status;
    rec.updatedAt = new Date();
    return this.getAdaptiveRecommendationById(id);
  },

  /**
   * Create teacher override record
   */
  async createAdaptiveOverrideRecord(payload: any) {
    const id = `ovr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    try {
      if (hasValidDatabaseUrl) {
        return await prisma.adaptiveRecommendationOverride.create({
          data: {
            id,
            recommendationId: payload.recommendationId,
            teacherId: payload.teacherId,
            originalDecision: payload.originalDecision,
            overrideDecision: payload.overrideDecision,
            reason: payload.reason,
            createdAt: now,
          },
        });
      }
    } catch (e) {
      console.warn("createAdaptiveOverrideRecord prisma fallback:", e);
    }

    const rec = {
      id,
      recommendationId: payload.recommendationId,
      teacherId: payload.teacherId,
      originalDecision: payload.originalDecision,
      overrideDecision: payload.overrideDecision,
      reason: payload.reason,
      createdAt: now,
    };
    if (!fallbackStore.adaptiveRecommendationOverrides) {
      fallbackStore.adaptiveRecommendationOverrides = [];
    }
    fallbackStore.adaptiveRecommendationOverrides.push(rec);
    return rec;
  },

  /**
   * Update recommendation based on teacher override
   */
  async applyTeacherOverrideToRecommendation(id: string, updates: any) {
    try {
      if (hasValidDatabaseUrl) {
        const updated = await prisma.adaptiveRecommendation.update({
          where: { id },
          data: {
            decisionType: updates.decisionType,
            reason: updates.reason,
            source: updates.source || "TEACHER_OVERRIDE",
            targetDifficulty: updates.targetDifficulty || undefined,
            recommendedActivityType: updates.recommendedActivityType || undefined,
            recommendedActivityId: updates.recommendedActivityId || undefined,
            updatedAt: new Date(),
          },
          include: {
            student: { select: { id: true, name: true, email: true } },
            skill: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
            overrides: {
              include: { teacher: { select: { id: true, name: true } } },
              orderBy: { createdAt: "desc" },
            },
          },
        });
        return updated;
      }
    } catch (e) {
      console.warn("applyTeacherOverrideToRecommendation prisma fallback:", e);
    }

    const rec = (fallbackStore.adaptiveRecommendations || []).find((r) => r.id === id);
    if (!rec) return null;

    rec.decisionType = updates.decisionType;
    rec.reason = updates.reason;
    rec.source = updates.source || "TEACHER_OVERRIDE";
    if (updates.targetDifficulty) rec.targetDifficulty = updates.targetDifficulty;
    if (updates.recommendedActivityType) rec.recommendedActivityType = updates.recommendedActivityType;
    if (updates.recommendedActivityId) rec.recommendedActivityId = updates.recommendedActivityId;
    rec.updatedAt = new Date();

    return this.getAdaptiveRecommendationById(id);
  },

  /**
   * Get student recommendation history
   */
  async getStudentAdaptiveHistory(studentId: string, options?: { limit?: number }) {
    const limit = options?.limit || 20;

    try {
      if (hasValidDatabaseUrl) {
        const list = await prisma.adaptiveRecommendation.findMany({
          where: { studentId },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            student: { select: { id: true, name: true, email: true } },
            skill: { select: { id: true, title: true } },
            lesson: { select: { id: true, title: true } },
            overrides: {
              include: { teacher: { select: { id: true, name: true } } },
              orderBy: { createdAt: "desc" },
            },
          },
        });
        return list;
      }
    } catch (e) {
      console.warn("getStudentAdaptiveHistory prisma fallback:", e);
    }

    return (fallbackStore.adaptiveRecommendations || [])
      .filter((r) => r.studentId === studentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map((rec) => {
        const student = fallbackStore.users.find((u) => u.id === rec.studentId);
        const skill = fallbackStore.curriculum.skills.find((s) => s.id === rec.skillId);
        const lesson = fallbackStore.curriculum.lessons.find((l) => l.id === rec.lessonId);
        const overrides = (fallbackStore.adaptiveRecommendationOverrides || [])
          .filter((o) => o.recommendationId === rec.id)
          .map((o) => {
            const teacher = fallbackStore.users.find((u) => u.id === o.teacherId);
            return { ...o, teacher: teacher ? { id: teacher.id, name: teacher.name } : null };
          });

        return {
          ...rec,
          student: student ? { id: student.id, name: student.name, email: student.email } : null,
          skill: skill ? { id: skill.id, title: skill.title } : null,
          lesson: lesson ? { id: lesson.id, title: lesson.title } : null,
          overrides,
        };
      });
  },

  // -------------------------------------------------------------
  // PHASE 10: MASTERY ENGINE DATABASE METHODS
  // -------------------------------------------------------------

  /**
   * Get single skill mastery for a student
   */
  async getSkillMastery(studentId: string, skillId: string) {
    try {
      if (hasValidDatabaseUrl) {
        const mastery = await prisma.skillMastery.findUnique({
          where: { studentId_skillId: { studentId, skillId } },
          include: {
            skill: { select: { id: true, title: true } },
            student: { select: { id: true, name: true, email: true } },
            history: { orderBy: { createdAt: "desc" } },
          },
        });
        if (mastery) return mastery;
      }
    } catch (e) {
      console.warn("getSkillMastery prisma fallback:", e);
    }

    const rec = (fallbackStore.skillMasteries || []).find(
      (m) => m.studentId === studentId && m.skillId === skillId
    );
    if (!rec) return null;

    const student = fallbackStore.users.find((u) => u.id === rec.studentId);
    const skill = fallbackStore.curriculum.skills.find((s) => s.id === rec.skillId);
    const history = (fallbackStore.skillMasteryHistory || [])
      .filter((h) => h.skillMasteryId === rec.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      ...rec,
      student: student ? { id: student.id, name: student.name, email: student.email } : null,
      skill: skill ? { id: skill.id, title: skill.title } : null,
      history,
    };
  },

  /**
   * Get all skill masteries for a student
   */
  async getStudentSkillMasteries(studentId: string) {
    try {
      if (hasValidDatabaseUrl) {
        const masteries = await prisma.skillMastery.findMany({
          where: { studentId },
          include: {
            skill: { select: { id: true, title: true } },
            student: { select: { id: true, name: true, email: true } },
            history: { orderBy: { createdAt: "desc" }, take: 5 },
          },
          orderBy: { updatedAt: "desc" },
        });
        if (masteries.length > 0) return masteries;
      }
    } catch (e) {
      console.warn("getStudentSkillMasteries prisma fallback:", e);
    }

    return (fallbackStore.skillMasteries || [])
      .filter((m) => m.studentId === studentId)
      .map((rec) => {
        const student = fallbackStore.users.find((u) => u.id === rec.studentId);
        const skill = fallbackStore.curriculum.skills.find((s) => s.id === rec.skillId);
        const history = (fallbackStore.skillMasteryHistory || [])
          .filter((h) => h.skillMasteryId === rec.id)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
          ...rec,
          student: student ? { id: student.id, name: student.name, email: student.email } : null,
          skill: skill ? { id: skill.id, title: skill.title } : null,
          history,
        };
      });
  },

  /**
   * Upsert skill mastery
   */
  async saveSkillMastery(data: {
    studentId: string;
    skillId: string;
    status: any;
    evidenceSummary: string;
    accuracy: number;
    recentAccuracy: number;
    consistencyScore: number;
    applicationScore: number;
    attemptCount: number;
    masteryVersion: string;
    metadata: string;
  }) {
    try {
      if (hasValidDatabaseUrl) {
        const saved = await prisma.skillMastery.upsert({
          where: { studentId_skillId: { studentId: data.studentId, skillId: data.skillId } },
          create: {
            ...data,
            lastEvaluatedAt: new Date(),
          },
          update: {
            ...data,
            lastEvaluatedAt: new Date(),
          },
        });
        return saved;
      }
    } catch (e) {
      console.warn("saveSkillMastery prisma fallback:", e);
    }

    if (!fallbackStore.skillMasteries) fallbackStore.skillMasteries = [];
    const idx = fallbackStore.skillMasteries.findIndex(
      (m) => m.studentId === data.studentId && m.skillId === data.skillId
    );

    const record = {
      id: idx >= 0 ? fallbackStore.skillMasteries[idx].id : `mstr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      lastEvaluatedAt: new Date(),
      createdAt: idx >= 0 ? fallbackStore.skillMasteries[idx].createdAt : new Date(),
      updatedAt: new Date(),
    };

    if (idx >= 0) fallbackStore.skillMasteries[idx] = record;
    else fallbackStore.skillMasteries.push(record);

    return record;
  },

  /**
   * Record history transition for skill mastery
   */
  async recordSkillMasteryHistory(data: {
    skillMasteryId: string;
    previousStatus: any;
    newStatus: any;
    reason: string;
    evidenceSummary: string;
    masteryVersion: string;
    metadata: string;
  }) {
    try {
      if (hasValidDatabaseUrl) {
        const entry = await prisma.skillMasteryHistory.create({
          data,
        });
        return entry;
      }
    } catch (e) {
      console.warn("recordSkillMasteryHistory prisma fallback:", e);
    }

    if (!fallbackStore.skillMasteryHistory) fallbackStore.skillMasteryHistory = [];
    const entry = {
      id: `mstr_hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...data,
      createdAt: new Date(),
    };
    fallbackStore.skillMasteryHistory.push(entry);
    return entry;
  },
};


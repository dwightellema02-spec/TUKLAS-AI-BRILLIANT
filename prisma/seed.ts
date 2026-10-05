/**
 * Tuklas AI - Initial Seed Data (Phase 2)
 * Seeds MATATAG Grade 7 Mathematics (Term 1) baseline sample and default test roles.
 */

import { PrismaClient, UserRole, LessonStatus, ProgressStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function seedDatabase() {
  // SEED_CURRICULUM_ONLY=true seeds only the MATATAG Grade 7 curriculum (no accounts, no progress),
  // which is the safe way to initialise a production database.
  const curriculumOnly = process.env.SEED_CURRICULUM_ONLY === "true";
  if (!curriculumOnly && process.env.NODE_ENV === "production" && process.env.SEED_DEMO_USERS_IN_PRODUCTION !== "I_UNDERSTAND_THESE_PASSWORDS_ARE_PUBLIC") {
    console.error(
      "Refusing to seed in production: this script creates student/teacher/ADMIN accounts with a publicly known password. " +
        "Use `npx tsx scripts/create-admin.ts` to create the first administrator instead."
    );
    process.exit(1);
  }
  console.log("🌱 Starting Tuklas AI Phase 2 database seed...");

  // 1. Create Default Role Users (Passwords securely hashed with bcrypt)
  let studentUser: { id: string; email: string } | null = null;
  let teacherUser: { id: string; email: string } | null = null;
  if (!curriculumOnly) {
    const defaultPassword = await bcrypt.hash("Tuklas2026!", 10);

    studentUser = await prisma.user.upsert({
      where: { email: "student@tuklas.ai" },
      update: {},
      create: {
        email: "student@tuklas.ai",
        name: "Juan de la Cruz",
        passwordHash: defaultPassword,
        role: UserRole.STUDENT,
        gradeLevel: 7,
      },
    });

    teacherUser = await prisma.user.upsert({
      where: { email: "teacher@tuklas.ai" },
      update: {},
      create: {
        email: "teacher@tuklas.ai",
        name: "Maria Santos (Teacher)",
        passwordHash: defaultPassword,
        role: UserRole.TEACHER,
      },
    });

    const adminUser = await prisma.user.upsert({
      where: { email: "admin@tuklas.ai" },
      update: {},
      create: {
        email: "admin@tuklas.ai",
        name: "Tuklas Administrator",
        passwordHash: defaultPassword,
        role: UserRole.ADMIN,
      },
    });

    console.log(`✅ Users seeded: Student (${studentUser.email}), Teacher (${teacherUser.email}), Admin (${adminUser.email})`);

  }

  // 2. Create Subject: Mathematics
  const subject = await prisma.subject.upsert({
    where: { code: "MATH" },
    update: {},
    create: {
      code: "MATH",
      name: "Mathematics",
      description: "Department of Education MATATAG Mathematics Curriculum",
    },
  });

  // 3. Create Grade: Grade 7
  const grade = await prisma.grade.upsert({
    where: {
      subjectId_level: {
        subjectId: subject.id,
        level: 7,
      },
    },
    update: {},
    create: {
      subjectId: subject.id,
      level: 7,
      name: "Grade 7",
    },
  });

  // 4. Create Term: Term 1
  const term = await prisma.term.upsert({
    where: {
      gradeId_termNumber: {
        gradeId: grade.id,
        termNumber: 1,
      },
    },
    update: {},
    create: {
      gradeId: grade.id,
      termNumber: 1,
      name: "Term 1",
    },
  });

  // 5. Create Unit: Numbers and Algebraic Expressions
  let unit = await prisma.unit.findFirst({
    where: { termId: term.id, title: "Numbers and Algebraic Expressions" },
  });

  if (!unit) {
    unit = await prisma.unit.create({
      data: {
        termId: term.id,
        sequenceOrder: 1,
        title: "Numbers and Algebraic Expressions",
        description: "Foundational number concepts, integers, and operations for Grade 7 MATATAG.",
      },
    });
  }

  // 6. Create Lesson: Understanding Integers
  let lesson = await prisma.lesson.findFirst({
    where: { unitId: unit.id, title: "Understanding Integers" },
  });

  if (!lesson) {
    lesson = await prisma.lesson.create({
      data: {
        unitId: unit.id,
        authorId: teacherUser?.id,
        sequenceOrder: 1,
        title: "Understanding Integers",
        description: "An intuitive introduction to positive and negative integers, real-world models, and number line representations.",
        learningObjectives: [
          "Define positive and negative integers in real-life contexts",
          "Compare and arrange integers on a horizontal number line",
          "Identify opposite values and absolute magnitude",
        ],
        status: LessonStatus.PUBLISHED,
        estimatedMinutes: 20,
      },
    });
  }

  // 7. Create Competency
  let competency = await prisma.competency.findFirst({
    where: { unitId: unit.id, code: "M7NS-Ia-1" },
  });

  if (!competency) {
    competency = await prisma.competency.create({
      data: {
        unitId: unit.id,
        code: "M7NS-Ia-1",
        statement: "Describes and illustrates the sets of integers and integers on a number line.",
        sequenceOrder: 1,
      },
    });
  }

  // 8. Create Skills with Prerequisite Relationships
  // Skill 1: Identify integers
  let skill1 = await prisma.skill.findFirst({
    where: { competencyId: competency.id, title: "Identify integers" },
  });
  if (!skill1) {
    skill1 = await prisma.skill.create({
      data: {
        competencyId: competency.id,
        title: "Identify integers",
        description: "Differentiate between positive, negative, and zero integers in physical scenarios.",
        sequenceOrder: 1,
        difficulty: 1.0,
      },
    });
  }

  // Skill 2: Compare integers (Prerequisite: Identify integers)
  let skill2 = await prisma.skill.findFirst({
    where: { competencyId: competency.id, title: "Compare integers" },
  });
  if (!skill2) {
    skill2 = await prisma.skill.create({
      data: {
        competencyId: competency.id,
        title: "Compare integers",
        description: "Use inequality symbols (<, >, =) to compare signed values.",
        sequenceOrder: 2,
        difficulty: 1.5,
      },
    });

    await prisma.skillPrerequisite.upsert({
      where: {
        skillId_prerequisiteSkillId: {
          skillId: skill2.id,
          prerequisiteSkillId: skill1.id,
        },
      },
      update: {},
      create: {
        skillId: skill2.id,
        prerequisiteSkillId: skill1.id,
      },
    });
  }

  // Skill 3: Represent integers on a number line (Prerequisite: Compare integers)
  let skill3 = await prisma.skill.findFirst({
    where: { competencyId: competency.id, title: "Represent integers on a number line" },
  });
  if (!skill3) {
    skill3 = await prisma.skill.create({
      data: {
        competencyId: competency.id,
        title: "Represent integers on a number line",
        description: "Plot and translate points on a discrete horizontal axis.",
        sequenceOrder: 3,
        difficulty: 2.0,
      },
    });

    await prisma.skillPrerequisite.upsert({
      where: {
        skillId_prerequisiteSkillId: {
          skillId: skill3.id,
          prerequisiteSkillId: skill2.id,
        },
      },
      update: {},
      create: {
        skillId: skill3.id,
        prerequisiteSkillId: skill2.id,
      },
    });
  }

  // 9. Create Student Progress Record
  if (studentUser) await prisma.studentProgress.upsert({
    where: {
      userId_skillId: {
        userId: studentUser!.id,
        skillId: skill1.id,
      },
    },
    update: {},
    create: {
      userId: studentUser!.id,
      lessonId: lesson.id,
      skillId: skill1.id,
      status: ProgressStatus.DEVELOPING,
      progressPercentage: 65,
      understandingScore: 0.70,
      accuracyScore: 0.60,
      applicationScore: 0.65,
      consistencyScore: 0.55,
      compositeScore: 0.63,
      attemptCount: 3,
    },
  });

  console.log("✅ Curriculum hierarchy & sample skills seeded successfully!");
}

if (process.env.NODE_ENV !== "test") {
  seedDatabase()
    .catch((e) => {
      console.error("❌ Seed execution error:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

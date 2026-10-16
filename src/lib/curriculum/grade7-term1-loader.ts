/**
 * Idempotent loader for the Grade 7 Term 1 (weeks 1-6) curriculum. Safe to run repeatedly: every row is found by a stable key
 * (unit title, competency code, skill title, lesson title, question seedKey in metadata, practice set title) and created only once.
 * Existing rows are never overwritten, so a teacher's edits survive a re-seed.
 */
import type { PrismaClient } from "@prisma/client";
import { GRADE7_TERM1_UNITS, GRADE7_TERM1_COMPETENCIES, GRADE7_TERM1_SKILLS, GRADE7_TERM1_LESSONS, GRADE7_TERM1_QUESTIONS } from "./grade7-term1";

/**
 * Titles of the weekly lessons that Phase 49 replaced with one lesson per day (each week held several days of content in one lesson).
 * A database seeded before Phase 49 still has them: they are archived (never deleted) so students no longer see them.
 */
export const RETIRED_WEEKLY_LESSON_TITLES = [
  "Polygons: Naming, Regular and Irregular, and Drawing Them",
  "Convex and Non-Convex Polygons; Angle Pairs",
  "Interior and Exterior Angles of Polygons",
  "Percentage Increase and Percentage Decrease",
  "Money Problems with Percentages and a Daily Financial Plan",
  "Rates and Unit Rates",
];

export async function loadGrade7Term1(prisma: PrismaClient, termId: string, opts: { authorId?: string | null } = {}) {
  const unitIds: Record<string, string> = {};
  for (const u of GRADE7_TERM1_UNITS) {
    const found = await prisma.unit.findFirst({ where: { termId, title: u.title } });
    unitIds[u.key] = (found ?? (await prisma.unit.create({ data: { termId, title: u.title, description: u.description, sequenceOrder: u.sequenceOrder } }))).id;
  }

  const compIds: Record<string, string> = {};
  for (const c of GRADE7_TERM1_COMPETENCIES) {
    const unitId = unitIds[c.unit];
    const found = await prisma.competency.findFirst({ where: { unitId, code: c.code } });
    compIds[c.key] = (found ?? (await prisma.competency.create({ data: { unitId, code: c.code, statement: c.statement, sequenceOrder: c.week } }))).id;
  }

  const skillIds: Record<string, string> = {};
  let order = 0;
  for (const sk of GRADE7_TERM1_SKILLS) {
    order += 1;
    const competencyId = compIds[sk.competency];
    const found = await prisma.skill.findFirst({ where: { competencyId, title: sk.title } });
    skillIds[sk.key] = (found ?? (await prisma.skill.create({ data: { competencyId, title: sk.title, description: sk.description, sequenceOrder: order, difficulty: sk.difficulty } }))).id;
  }
  for (const sk of GRADE7_TERM1_SKILLS) {
    for (const pre of sk.prerequisites) {
      await prisma.skillPrerequisite.upsert({
        where: { skillId_prerequisiteSkillId: { skillId: skillIds[sk.key], prerequisiteSkillId: skillIds[pre] } },
        update: {},
        create: { skillId: skillIds[sk.key], prerequisiteSkillId: skillIds[pre] },
      });
    }
  }

  const retired = await prisma.lesson.findMany({ where: { title: { in: RETIRED_WEEKLY_LESSON_TITLES }, unitId: { in: Object.values(unitIds) } }, select: { id: true } });
  const retiredIds = retired.map((r) => r.id);
  if (retiredIds.length) {
    await prisma.lesson.updateMany({ where: { id: { in: retiredIds }, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
    await prisma.practiceSet.updateMany({ where: { lessonId: { in: retiredIds }, status: { not: "ARCHIVED" } }, data: { status: "ARCHIVED" } });
  }

  // Prerequisites the seed no longer lists are removed (a database seeded earlier may still require a skill from the held-back Week 1)
  const seedPairs = new Set(GRADE7_TERM1_SKILLS.flatMap((sk) => sk.prerequisites.map((pre) => `${skillIds[sk.key]}>${skillIds[pre]}`)));
  const ours = Object.values(skillIds);
  const stale = (await prisma.skillPrerequisite.findMany({ where: { skillId: { in: ours }, prerequisiteSkillId: { in: ours } }, select: { skillId: true, prerequisiteSkillId: true } }))
    .filter((r) => !seedPairs.has(`${r.skillId}>${r.prerequisiteSkillId}`));
  for (const r of stale) await prisma.skillPrerequisite.delete({ where: { skillId_prerequisiteSkillId: { skillId: r.skillId, prerequisiteSkillId: r.prerequisiteSkillId } } });

  const lessonIds: Record<string, string> = {};
  const questionIds: Record<string, string> = {};
  let seq = 0;
  for (const l of GRADE7_TERM1_LESSONS) {
    seq += 1;
    const unitId = unitIds[l.unit];
    let lesson = await prisma.lesson.findFirst({ where: { unitId, title: l.title } });
    if (!lesson) {
      lesson = await prisma.lesson.create({
        data: { unitId, authorId: opts.authorId ?? undefined, sequenceOrder: seq, title: l.title, description: l.description, learningObjectives: l.objectives, status: l.published === false ? "DRAFT" : "PUBLISHED", estimatedMinutes: l.minutes },
      });
      let i = 0;
      for (const b of l.blocks) {
        i += 1;
        await prisma.lessonContentBlock.create({
          data: { lessonId: lesson.id, sequenceOrder: i, type: b.type, title: b.title, content: b.content, metadata: b.metadata ? JSON.stringify(b.metadata) : null },
        });
      }
      await prisma.lessonResource.create({ data: { lessonId: lesson.id, type: "TEACHER_NOTE", title: "Alignment and teaching notes", notes: l.teacherNote, sequenceOrder: 1 } });
    }
    else if (l.published === false && lesson.status === "PUBLISHED") {
      // a lesson that must not be shown yet (its Lesson Exemplar has not been supplied): a database seeded earlier may have it published
      await prisma.lesson.update({ where: { id: lesson.id }, data: { status: "DRAFT" } });
    }
    lessonIds[l.key] = lesson.id;
    for (const k of l.skills) {
      await prisma.lessonSkill.upsert({
        where: { lessonId_skillId: { lessonId: lesson.id, skillId: skillIds[k] } },
        update: {}, create: { lessonId: lesson.id, skillId: skillIds[k] },
      });
    }
  }

  // question bank (one row per seed key). A question belongs to the lesson whose practice set uses it; a question no practice set uses
  // belongs to the first lesson that teaches its skill.
  const lessonOfSkill: Record<string, string> = {};
  for (const l of GRADE7_TERM1_LESSONS) for (const k of l.skills) if (!lessonOfSkill[k]) lessonOfSkill[k] = lessonIds[l.key];
  const hiddenLessonIds = GRADE7_TERM1_LESSONS.filter((l) => l.published === false).map((l) => lessonIds[l.key]);
  const lessonOfQuestion: Record<string, string> = {};
  for (const l of GRADE7_TERM1_LESSONS) for (const k of l.practice) if (!lessonOfQuestion[k]) lessonOfQuestion[k] = lessonIds[l.key];
  const existing = await prisma.question.findMany({ where: { metadata: { contains: "grade7-term1" } }, select: { id: true, metadata: true } });
  for (const e of existing) {
    try { const k = JSON.parse(e.metadata ?? "{}").seedKey; if (k) questionIds[k] = e.id; } catch { /* not ours */ }
  }
  if (retiredIds.length) {
    // questions that were attached to a retired weekly lesson move to the daily lesson that now uses them
    for (const q of GRADE7_TERM1_QUESTIONS) {
      const id = questionIds[q.key]; const target = lessonOfQuestion[q.key] ?? lessonOfSkill[q.skill];
      if (id && target) await prisma.question.updateMany({ where: { id, lessonId: { in: retiredIds } }, data: { lessonId: target } });
    }
  }
  for (const q of GRADE7_TERM1_QUESTIONS) {
    if (questionIds[q.key]) continue;
    let questionData: any;
    if (q.type === "MULTIPLE_CHOICE") questionData = { choices: q.choices.map((text, i) => ({ id: `c${i + 1}`, text })), correctAnswer: `c${q.correctIndex + 1}` };
    else if (q.type === "NUMERIC_INPUT") questionData = { correctAnswer: q.answer, ...(q.tolerance != null ? { tolerance: q.tolerance } : {}), ...(q.unit ? { unit: q.unit } : {}) };
    else questionData = { correctAnswer: q.answer };
    const row = await prisma.question.create({
      data: {
        skillId: skillIds[q.skill], lessonId: lessonOfQuestion[q.key] ?? lessonOfSkill[q.skill], type: q.type, prompt: q.prompt, questionData: JSON.stringify(questionData),
        explanation: q.explanation, difficulty: q.difficulty, status: hiddenLessonIds.includes(lessonOfQuestion[q.key] ?? lessonOfSkill[q.skill]) ? "DRAFT" : "PUBLISHED", source: "SYSTEM",
        metadata: JSON.stringify({ seedKey: q.key, source: "grade7-term1" }),
      },
    });
    questionIds[q.key] = row.id;
  }

  // questions of a lesson that is not shown yet stay hidden too (a student must not be asked about a week whose lesson is not published)
  if (hiddenLessonIds.length) await prisma.question.updateMany({ where: { lessonId: { in: hiddenLessonIds }, source: "SYSTEM", status: "PUBLISHED" }, data: { status: "DRAFT" } });

  // one practice set per lesson
  for (const l of GRADE7_TERM1_LESSONS) {
    if (l.published === false) continue; // no practice set for a lesson that is not shown yet
    const title = `Practice: ${l.title}`;
    const found = await prisma.practiceSet.findFirst({ where: { title } });
    if (found) continue;
    await prisma.practiceSet.create({
      data: {
        title, description: l.day ? `Practice for Week ${l.week}, Day ${l.day}.` : `Practice for Week ${l.week}.`, lessonId: lessonIds[l.key], status: "PUBLISHED", questionCount: l.practice.length,
        questions: { create: l.practice.map((k, i) => ({ questionId: questionIds[k], order: i + 1 })) },
      },
    });
  }
  return { units: GRADE7_TERM1_UNITS.length, skills: GRADE7_TERM1_SKILLS.length, lessons: GRADE7_TERM1_LESSONS.length, questions: GRADE7_TERM1_QUESTIONS.length };
}

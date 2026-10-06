/**
 * Phase 41: teachers add the curriculum structure for the rest of the course (units in any term, competencies, skills, skill prerequisites).
 * Database mode only: the in-memory demo curriculum is a single fixed unit.
 *
 * Rules: a teacher or administrator may add; edit/delete follow the same rule as lessons (the creator or an administrator; rows with no
 * creator, i.e. shipped with the platform, may be edited by any teacher). Anything that still holds other things (a unit with lessons,
 * a skill that questions, lessons or student progress refer to) cannot be deleted, and the answer says what is in the way.
 */
import { hasValidDatabaseUrl, prisma } from "../db";

export class StructureError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409) {
    super(message);
    this.name = "StructureError";
  }
}

export interface Actor { userId: string; role: string }

const isStaff = (a: Actor) => a.role === "TEACHER" || a.role === "ADMIN";
const MAX_UNITS_PER_TERM = 40;
const MAX_COMPETENCIES_PER_UNIT = 60;
const MAX_SKILLS_PER_COMPETENCY = 60;

function need(a: Actor) {
  if (!isStaff(a)) throw new StructureError("Forbidden: Teacher or Administrator access required.", 403);
  if (!hasValidDatabaseUrl) throw new StructureError("Changing the curriculum structure needs the database. This demo mode has one fixed unit.", 409);
}

function text(input: unknown, min: number, max: number, label: string, optional = false): string | null {
  if (input === undefined || input === null || input === "") {
    if (optional) return null;
    throw new StructureError(`${label} is required`, 400);
  }
  if (typeof input !== "string") throw new StructureError(`${label} must be text`, 400);
  const t = input.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length < min || t.length > max) throw new StructureError(`${label} must be ${min}-${max} characters`, 400);
  return t;
}

function canEdit(actor: Actor, createdById: string | null): boolean {
  return actor.role === "ADMIN" || !createdById || createdById === actor.userId;
}
function ensureCanEdit(actor: Actor, createdById: string | null, what: string) {
  if (!canEdit(actor, createdById)) throw new StructureError(`Forbidden: this ${what} was added by another teacher.`, 403);
}

async function gradeSeven() {
  const subject = await prisma.subject.findUnique({ where: { code: "MATH" } });
  const grade = subject ? await prisma.grade.findUnique({ where: { subjectId_level: { subjectId: subject.id, level: 7 } } }) : null;
  if (!grade) throw new StructureError("The Grade 7 Mathematics curriculum has not been set up yet. Run the curriculum seed first.", 409);
  return grade;
}

export const StructureService = {
  // ---------------------------------------------------------------- units
  async createUnit(actor: Actor, input: { termNumber?: unknown; title?: unknown; description?: unknown }) {
    need(actor);
    const termNumber = Number(input.termNumber);
    if (!Number.isInteger(termNumber) || termNumber < 1 || termNumber > 3) throw new StructureError("Term must be 1, 2 or 3.", 400);
    const title = text(input.title, 3, 120, "Unit title")!;
    const description = text(input.description, 1, 500, "Description", true);
    const grade = await gradeSeven();
    const term = await prisma.term.upsert({
      where: { gradeId_termNumber: { gradeId: grade.id, termNumber } },
      update: {},
      create: { gradeId: grade.id, termNumber, name: `Term ${termNumber}` },
    });
    const existing = await prisma.unit.findMany({ where: { termId: term.id }, select: { title: true, sequenceOrder: true } });
    if (existing.length >= MAX_UNITS_PER_TERM) throw new StructureError(`A term can have at most ${MAX_UNITS_PER_TERM} units.`, 409);
    if (existing.some((u) => u.title.toLowerCase() === title.toLowerCase())) throw new StructureError("This term already has a unit with that title.", 409);
    return prisma.unit.create({
      data: { termId: term.id, title, description, sequenceOrder: Math.max(0, ...existing.map((u) => u.sequenceOrder)) + 1, createdById: actor.userId },
      include: { term: true },
    });
  },

  async updateUnit(actor: Actor, unitId: string, input: { title?: unknown; description?: unknown }) {
    need(actor);
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new StructureError("Unit not found", 404);
    ensureCanEdit(actor, unit.createdById, "unit");
    const data: { title?: string; description?: string | null } = {};
    if (input.title !== undefined) {
      data.title = text(input.title, 3, 120, "Unit title")!;
      const clash = await prisma.unit.findFirst({ where: { termId: unit.termId, id: { not: unit.id }, title: { equals: data.title, mode: "insensitive" } } });
      if (clash) throw new StructureError("This term already has a unit with that title.", 409);
    }
    if (input.description !== undefined) data.description = text(input.description, 1, 500, "Description", true);
    if (Object.keys(data).length === 0) throw new StructureError("Nothing to change.", 400);
    return prisma.unit.update({ where: { id: unit.id }, data });
  },

  async deleteUnit(actor: Actor, unitId: string) {
    need(actor);
    const unit = await prisma.unit.findUnique({ where: { id: unitId }, include: { _count: { select: { lessons: true, competencies: true } } } });
    if (!unit) throw new StructureError("Unit not found", 404);
    ensureCanEdit(actor, unit.createdById, "unit");
    if (unit._count.lessons > 0 || unit._count.competencies > 0) {
      throw new StructureError(`This unit still has ${unit._count.lessons} lesson(s) and ${unit._count.competencies} competenc${unit._count.competencies === 1 ? "y" : "ies"}. Remove or move them first.`, 409);
    }
    await prisma.unit.delete({ where: { id: unit.id } });
  },

  /** Put the units of one term in a new order. Order is a course-level matter, so any teacher or administrator may do it. */
  async reorderUnits(actor: Actor, termNumber: unknown, orderedUnitIds: unknown) {
    need(actor);
    const n = Number(termNumber);
    if (!Number.isInteger(n) || n < 1 || n > 3) throw new StructureError("Term must be 1, 2 or 3.", 400);
    if (!Array.isArray(orderedUnitIds) || orderedUnitIds.some((x) => typeof x !== "string")) throw new StructureError("orderedUnitIds must be a list of unit ids.", 400);
    const grade = await gradeSeven();
    const term = await prisma.term.findUnique({ where: { gradeId_termNumber: { gradeId: grade.id, termNumber: n } }, include: { units: { select: { id: true } } } });
    if (!term) throw new StructureError("That term has no units yet.", 404);
    const have = new Set(term.units.map((u) => u.id));
    const ids = orderedUnitIds as string[];
    if (ids.length !== have.size || new Set(ids).size !== ids.length || ids.some((id) => !have.has(id))) throw new StructureError("The list must contain every unit of the term exactly once.", 400);
    await prisma.$transaction(ids.map((id, i) => prisma.unit.update({ where: { id }, data: { sequenceOrder: i + 1 } })));
  },

  // ---------------------------------------------------------------- competencies
  async createCompetency(actor: Actor, unitId: string, input: { code?: unknown; statement?: unknown }) {
    need(actor);
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new StructureError("Unit not found", 404);
    ensureCanEdit(actor, unit.createdById, "unit");
    const statement = text(input.statement, 5, 400, "Competency statement")!;
    const siblings = await prisma.competency.findMany({ where: { unitId }, select: { code: true, sequenceOrder: true } });
    if (siblings.length >= MAX_COMPETENCIES_PER_UNIT) throw new StructureError(`A unit can have at most ${MAX_COMPETENCIES_PER_UNIT} competencies.`, 409);
    const seq = Math.max(0, ...siblings.map((c) => c.sequenceOrder)) + 1;
    const code = text(input.code, 2, 40, "Code", true) ?? `C${seq}`;
    if (siblings.some((c) => c.code.toLowerCase() === code.toLowerCase())) throw new StructureError("This unit already has a competency with that code.", 409);
    return prisma.competency.create({ data: { unitId, code, statement, sequenceOrder: seq, createdById: actor.userId } });
  },

  async updateCompetency(actor: Actor, id: string, input: { code?: unknown; statement?: unknown }) {
    need(actor);
    const c = await prisma.competency.findUnique({ where: { id } });
    if (!c) throw new StructureError("Competency not found", 404);
    ensureCanEdit(actor, c.createdById, "competency");
    const data: { code?: string; statement?: string } = {};
    if (input.statement !== undefined) data.statement = text(input.statement, 5, 400, "Competency statement")!;
    if (input.code !== undefined) {
      data.code = text(input.code, 2, 40, "Code")!;
      const clash = await prisma.competency.findFirst({ where: { unitId: c.unitId, id: { not: c.id }, code: { equals: data.code, mode: "insensitive" } } });
      if (clash) throw new StructureError("This unit already has a competency with that code.", 409);
    }
    if (Object.keys(data).length === 0) throw new StructureError("Nothing to change.", 400);
    return prisma.competency.update({ where: { id }, data });
  },

  async deleteCompetency(actor: Actor, id: string) {
    need(actor);
    const c = await prisma.competency.findUnique({ where: { id }, include: { _count: { select: { skills: true } } } });
    if (!c) throw new StructureError("Competency not found", 404);
    ensureCanEdit(actor, c.createdById, "competency");
    if (c._count.skills > 0) throw new StructureError(`This competency still has ${c._count.skills} skill(s). Remove them first.`, 409);
    await prisma.competency.delete({ where: { id } });
  },

  // ---------------------------------------------------------------- skills
  async createSkill(actor: Actor, competencyId: string, input: { title?: unknown; description?: unknown; difficulty?: unknown; prerequisiteSkillIds?: unknown }) {
    need(actor);
    const comp = await prisma.competency.findUnique({ where: { id: competencyId } });
    if (!comp) throw new StructureError("Competency not found", 404);
    ensureCanEdit(actor, comp.createdById, "competency");
    const title = text(input.title, 3, 120, "Skill title")!;
    const description = text(input.description, 1, 500, "Description", true);
    const difficulty = input.difficulty === undefined || input.difficulty === null || input.difficulty === "" ? 2 : Number(input.difficulty);
    if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 5) throw new StructureError("Difficulty must be a number from 1 to 5.", 400);
    const siblings = await prisma.skill.findMany({ where: { competencyId }, select: { title: true, sequenceOrder: true } });
    if (siblings.length >= MAX_SKILLS_PER_COMPETENCY) throw new StructureError(`A competency can have at most ${MAX_SKILLS_PER_COMPETENCY} skills.`, 409);
    if (siblings.some((s) => s.title.toLowerCase() === title.toLowerCase())) throw new StructureError("This competency already has a skill with that title.", 409);
    const skill = await prisma.skill.create({
      data: { competencyId, title, description, difficulty: Math.round(difficulty * 10) / 10, sequenceOrder: Math.max(0, ...siblings.map((s) => s.sequenceOrder)) + 1, createdById: actor.userId },
    });
    if (input.prerequisiteSkillIds !== undefined) {
      try { await this.setPrerequisites(actor, skill.id, input.prerequisiteSkillIds); }
      catch (e) { await prisma.skill.delete({ where: { id: skill.id } }); throw e; }
    }
    return skill;
  },

  async updateSkill(actor: Actor, id: string, input: { title?: unknown; description?: unknown; difficulty?: unknown }) {
    need(actor);
    const s = await prisma.skill.findUnique({ where: { id } });
    if (!s) throw new StructureError("Skill not found", 404);
    ensureCanEdit(actor, s.createdById, "skill");
    const data: { title?: string; description?: string | null; difficulty?: number } = {};
    if (input.title !== undefined) {
      data.title = text(input.title, 3, 120, "Skill title")!;
      const clash = await prisma.skill.findFirst({ where: { competencyId: s.competencyId, id: { not: s.id }, title: { equals: data.title, mode: "insensitive" } } });
      if (clash) throw new StructureError("This competency already has a skill with that title.", 409);
    }
    if (input.description !== undefined) data.description = text(input.description, 1, 500, "Description", true);
    if (input.difficulty !== undefined) {
      const d = Number(input.difficulty);
      if (!Number.isFinite(d) || d < 1 || d > 5) throw new StructureError("Difficulty must be a number from 1 to 5.", 400);
      data.difficulty = Math.round(d * 10) / 10;
    }
    if (Object.keys(data).length === 0) throw new StructureError("Nothing to change.", 400);
    return prisma.skill.update({ where: { id }, data });
  },

  async deleteSkill(actor: Actor, id: string) {
    need(actor);
    const s = await prisma.skill.findUnique({
      where: { id },
      include: { _count: { select: { lessons: true, questions: true, practiceSets: true, progress: true, masteries: true, requiredBy: true } } },
    });
    if (!s) throw new StructureError("Skill not found", 404);
    ensureCanEdit(actor, s.createdById, "skill");
    const c = s._count;
    const used = [
      c.lessons && `${c.lessons} lesson(s)`, c.questions && `${c.questions} question(s)`, c.practiceSets && `${c.practiceSets} practice set(s)`,
      c.progress && `${c.progress} student progress record(s)`, c.masteries && `${c.masteries} mastery record(s)`, c.requiredBy && `${c.requiredBy} other skill(s) that require it`,
    ].filter(Boolean);
    if (used.length > 0) throw new StructureError(`This skill is still used by ${used.join(", ")}. Remove those links first.`, 409);
    await prisma.skill.delete({ where: { id } });
  },

  // ---------------------------------------------------------------- prerequisites (database-backed: the old check looked at the demo store)
  async setPrerequisites(actor: Actor, skillId: string, raw: unknown) {
    need(actor);
    if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string")) throw new StructureError("prerequisiteSkillIds must be an array of skill ids.", 400);
    const ids = [...new Set(raw as string[])];
    if (ids.length > 30) throw new StructureError("A skill can have at most 30 prerequisites.", 400);
    const skill = await prisma.skill.findUnique({ where: { id: skillId } });
    if (!skill) throw new StructureError("Skill not found", 404);
    ensureCanEdit(actor, skill.createdById, "skill");
    if (ids.includes(skillId)) throw new StructureError("A skill cannot be a prerequisite of itself.", 400);
    const found = await prisma.skill.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) throw new StructureError("One of the prerequisite skills does not exist.", 404);
    // a prerequisite must not (directly or through others) already depend on this skill
    const edges = await prisma.skillPrerequisite.findMany({ select: { skillId: true, prerequisiteSkillId: true } });
    const requires = new Map<string, string[]>();
    for (const e of edges) { if (e.skillId === skillId) continue; (requires.get(e.skillId) ?? requires.set(e.skillId, []).get(e.skillId)!).push(e.prerequisiteSkillId); }
    const reaches = (from: string, target: string, seen = new Set<string>()): boolean => {
      if (from === target) return true;
      if (seen.has(from)) return false;
      seen.add(from);
      return (requires.get(from) ?? []).some((n) => reaches(n, target, seen));
    };
    for (const p of ids) if (reaches(p, skillId)) throw new StructureError("That would create a circle: one of those prerequisites already depends on this skill.", 400);
    await prisma.$transaction([
      prisma.skillPrerequisite.deleteMany({ where: { skillId } }),
      prisma.skillPrerequisite.createMany({ data: ids.map((prerequisiteSkillId) => ({ skillId, prerequisiteSkillId })) }),
    ]);
  },
};

/**
 * Phase 25: Classroom persistence (PostgreSQL via Prisma, or the in-memory store in dev mode).
 * Pure data access: ownership/authorization rules live in classroom-service.ts.
 */

import crypto from "crypto";
import { fallbackStore, hasValidDatabaseUrl, prisma } from "../db";

export interface ClassroomRecord {
  id: string;
  name: string;
  gradeLevel: number;
  subject: string;
  schoolYear: string;
  teacherId: string;
  joinCode: string | null;
  joinCodeActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UnlockRecord {
  id: string;
  classroomId: string;
  lessonId: string;
  /** "" = the whole class */
  studentId: string;
  createdById: string;
  createdAt: Date;
}

export interface EnrollmentRecord {
  id: string;
  classroomId: string;
  studentId: string;
  source: string;
  enrolledAt: Date;
}

export interface AssignmentRecord {
  id: string;
  classroomId: string;
  title: string;
  description: string | null;
  lessonId: string | null;
  practiceSetId: string | null;
  dueDate: Date | null;
  status: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Unambiguous characters only (no 0/O, 1/I/L): codes get read aloud and copied from a whiteboard.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const JOIN_CODE_LENGTH = 6;

export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

export function normalizeJoinCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.trim().toUpperCase().replace(/[\s-]/g, "");
  return new RegExp(`^[${CODE_ALPHABET}]{${JOIN_CODE_LENGTH}}$`).test(code) ? code : null;
}

const dbMode = () => hasValidDatabaseUrl;

function toClassroom(r: any): ClassroomRecord {
  return {
    id: r.id,
    name: r.name,
    gradeLevel: r.gradeLevel,
    subject: r.subject,
    schoolYear: r.schoolYear,
    teacherId: r.teacherId,
    joinCode: r.joinCode ?? null,
    joinCodeActive: r.joinCodeActive ?? true,
    archivedAt: r.archivedAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toAssignment(r: any): AssignmentRecord {
  return {
    id: r.id,
    classroomId: r.classroomId,
    title: r.title,
    description: r.description ?? null,
    lessonId: r.lessonId ?? null,
    practiceSetId: r.practiceSetId ?? null,
    dueDate: r.dueDate ?? null,
    status: r.status,
    createdById: r.createdById ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export const ClassroomRepo = {
  // ----------------------------------------------------------------------------------------
  // Classrooms
  // ----------------------------------------------------------------------------------------
  async create(data: { teacherId: string; name: string; gradeLevel: number; subject: string; schoolYear: string }): Promise<ClassroomRecord> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const joinCode = generateJoinCode();
      if (dbMode()) {
        try {
          const row = await prisma.classroom.create({ data: { ...data, joinCode } });
          return toClassroom(row);
        } catch (e: any) {
          if (e?.code === "P2002") continue; // join code collision: try another
          throw e;
        }
      }
      if ((fallbackStore.classrooms as any[]).some((c) => c.joinCode === joinCode)) continue;
      const rec = {
        id: `cls_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
        ...data,
        joinCode,
        joinCodeActive: true,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      fallbackStore.classrooms.push(rec);
      return toClassroom(rec);
    }
    throw new Error("Could not allocate a unique join code. Please try again.");
  },

  async getById(id: string): Promise<ClassroomRecord | null> {
    if (dbMode()) {
      const row = await prisma.classroom.findUnique({ where: { id } });
      return row ? toClassroom(row) : null;
    }
    const rec = (fallbackStore.classrooms as any[]).find((c) => c.id === id);
    return rec ? toClassroom(rec) : null;
  },

  async getByJoinCode(code: string): Promise<ClassroomRecord | null> {
    if (dbMode()) {
      const row = await prisma.classroom.findUnique({ where: { joinCode: code } });
      return row ? toClassroom(row) : null;
    }
    const rec = (fallbackStore.classrooms as any[]).find((c) => c.joinCode === code);
    return rec ? toClassroom(rec) : null;
  },

  async listForTeacher(teacherId: string | null, opts: { includeArchived?: boolean } = {}): Promise<ClassroomRecord[]> {
    if (dbMode()) {
      const rows = await prisma.classroom.findMany({
        where: { ...(teacherId ? { teacherId } : {}), ...(opts.includeArchived ? {} : { archivedAt: null }) },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(toClassroom);
    }
    return (fallbackStore.classrooms as any[])
      .filter((c) => (!teacherId || c.teacherId === teacherId) && (opts.includeArchived || !c.archivedAt))
      .map(toClassroom);
  },

  async countForTeacher(teacherId: string): Promise<number> {
    return (await this.listForTeacher(teacherId)).length;
  },

  async update(id: string, patch: Partial<Pick<ClassroomRecord, "name" | "gradeLevel" | "subject" | "schoolYear" | "joinCode" | "joinCodeActive" | "archivedAt">>): Promise<ClassroomRecord | null> {
    if (dbMode()) {
      try {
        const row = await prisma.classroom.update({ where: { id }, data: patch });
        return toClassroom(row);
      } catch (e: any) {
        if (e?.code === "P2025") return null;
        throw e;
      }
    }
    const rec = (fallbackStore.classrooms as any[]).find((c) => c.id === id);
    if (!rec) return null;
    Object.assign(rec, patch, { updatedAt: new Date() });
    return toClassroom(rec);
  },

  /** Assign a fresh unique join code (also used to give legacy classes their first code). */
  async regenerateJoinCode(id: string): Promise<ClassroomRecord | null> {
    for (let attempt = 0; attempt < 12; attempt++) {
      const joinCode = generateJoinCode();
      try {
        if (!dbMode() && (fallbackStore.classrooms as any[]).some((c) => c.joinCode === joinCode)) continue;
        return await this.update(id, { joinCode });
      } catch (e: any) {
        if (e?.code === "P2002") continue;
        throw e;
      }
    }
    throw new Error("Could not allocate a unique join code. Please try again.");
  },

  // ----------------------------------------------------------------------------------------
  // Enrollments
  // ----------------------------------------------------------------------------------------
  async addEnrollment(classroomId: string, studentId: string, source: string): Promise<{ enrollment: EnrollmentRecord; created: boolean }> {
    if (dbMode()) {
      const existing = await prisma.classroomEnrollment.findUnique({ where: { classroomId_studentId: { classroomId, studentId } } });
      if (existing) return { enrollment: existing as EnrollmentRecord, created: false };
      try {
        const row = await prisma.classroomEnrollment.create({ data: { classroomId, studentId, source } });
        return { enrollment: row as EnrollmentRecord, created: true };
      } catch (e: any) {
        if (e?.code === "P2002") {
          const again = await prisma.classroomEnrollment.findUnique({ where: { classroomId_studentId: { classroomId, studentId } } });
          return { enrollment: again as EnrollmentRecord, created: false };
        }
        throw e;
      }
    }
    const list = fallbackStore.classroomEnrollments as any[];
    const existing = list.find((e) => e.classroomId === classroomId && e.studentId === studentId);
    if (existing) return { enrollment: existing, created: false };
    const rec = { id: `enr_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`, classroomId, studentId, source, enrolledAt: new Date() };
    list.push(rec);
    return { enrollment: rec, created: true };
  },

  async removeEnrollment(classroomId: string, studentId: string): Promise<boolean> {
    if (dbMode()) {
      const res = await prisma.classroomEnrollment.deleteMany({ where: { classroomId, studentId } });
      return res.count > 0;
    }
    const list = fallbackStore.classroomEnrollments as any[];
    const before = list.length;
    fallbackStore.classroomEnrollments = list.filter((e) => !(e.classroomId === classroomId && e.studentId === studentId));
    return fallbackStore.classroomEnrollments.length < before;
  },

  async listEnrollments(classroomIds: string[]): Promise<EnrollmentRecord[]> {
    if (classroomIds.length === 0) return [];
    if (dbMode()) {
      return (await prisma.classroomEnrollment.findMany({ where: { classroomId: { in: classroomIds } }, orderBy: { enrolledAt: "asc" } })) as EnrollmentRecord[];
    }
    return (fallbackStore.classroomEnrollments as any[]).filter((e) => classroomIds.includes(e.classroomId));
  },

  async listEnrollmentsForStudent(studentId: string): Promise<EnrollmentRecord[]> {
    if (dbMode()) {
      return (await prisma.classroomEnrollment.findMany({ where: { studentId } })) as EnrollmentRecord[];
    }
    return (fallbackStore.classroomEnrollments as any[]).filter((e) => e.studentId === studentId);
  },

  /** True when the student is enrolled in at least one ACTIVE (non-archived) class taught by the teacher. */
  async teacherHasStudent(teacherId: string, studentId: string): Promise<boolean> {
    if (dbMode()) {
      const hit = await prisma.classroomEnrollment.findFirst({
        where: { studentId, classroom: { teacherId, archivedAt: null } },
        select: { id: true },
      });
      return !!hit;
    }
    const classIds = (fallbackStore.classrooms as any[]).filter((c) => c.teacherId === teacherId && !c.archivedAt).map((c) => c.id);
    return (fallbackStore.classroomEnrollments as any[]).some((e) => classIds.includes(e.classroomId) && e.studentId === studentId);
  },

  // ----------------------------------------------------------------------------------------
  // Lesson openings (Phase 39). studentId "" = the whole class.
  // ----------------------------------------------------------------------------------------
  async listUnlocks(classroomId: string): Promise<UnlockRecord[]> {
    if (dbMode()) return (await prisma.lessonUnlock.findMany({ where: { classroomId }, orderBy: { createdAt: "asc" } })) as UnlockRecord[];
    return fallbackStore.lessonUnlocks.filter((u) => u.classroomId === classroomId);
  },

  async addUnlock(classroomId: string, lessonId: string, studentId: string, createdById: string): Promise<void> {
    if (dbMode()) {
      await prisma.lessonUnlock.upsert({
        where: { classroomId_lessonId_studentId: { classroomId, lessonId, studentId } },
        update: {},
        create: { classroomId, lessonId, studentId, createdById },
      });
      return;
    }
    if (fallbackStore.lessonUnlocks.some((u) => u.classroomId === classroomId && u.lessonId === lessonId && u.studentId === studentId)) return;
    fallbackStore.lessonUnlocks.push({ id: `unl_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`, classroomId, lessonId, studentId, createdById, createdAt: new Date() });
  },

  async removeUnlock(classroomId: string, lessonId: string, studentId: string): Promise<boolean> {
    if (dbMode()) {
      const r = await prisma.lessonUnlock.deleteMany({ where: { classroomId, lessonId, studentId } });
      return r.count > 0;
    }
    const before = fallbackStore.lessonUnlocks.length;
    fallbackStore.lessonUnlocks = fallbackStore.lessonUnlocks.filter((u) => !(u.classroomId === classroomId && u.lessonId === lessonId && u.studentId === studentId));
    return fallbackStore.lessonUnlocks.length < before;
  },

  // ----------------------------------------------------------------------------------------
  // Assignments
  // ----------------------------------------------------------------------------------------
  async createAssignment(data: { classroomId: string; title: string; description?: string | null; lessonId?: string | null; practiceSetId?: string | null; dueDate?: Date | null; createdById: string }): Promise<AssignmentRecord> {
    if (dbMode()) {
      const row = await prisma.assignment.create({
        data: {
          classroomId: data.classroomId,
          title: data.title,
          description: data.description ?? null,
          lessonId: data.lessonId ?? null,
          practiceSetId: data.practiceSetId ?? null,
          dueDate: data.dueDate ?? null,
          createdById: data.createdById,
        },
      });
      return toAssignment(row);
    }
    const rec = {
      id: `asg_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`,
      classroomId: data.classroomId,
      title: data.title,
      description: data.description ?? null,
      lessonId: data.lessonId ?? null,
      practiceSetId: data.practiceSetId ?? null,
      dueDate: data.dueDate ?? null,
      status: "PUBLISHED",
      createdById: data.createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (fallbackStore.assignments as any[]).push(rec);
    return toAssignment(rec);
  },

  async getAssignment(id: string): Promise<AssignmentRecord | null> {
    if (dbMode()) {
      const row = await prisma.assignment.findUnique({ where: { id } });
      return row ? toAssignment(row) : null;
    }
    const rec = (fallbackStore.assignments as any[]).find((a) => a.id === id);
    return rec ? toAssignment(rec) : null;
  },

  async listAssignments(classroomIds: string[], opts: { status?: string } = {}): Promise<AssignmentRecord[]> {
    if (classroomIds.length === 0) return [];
    if (dbMode()) {
      const rows = await prisma.assignment.findMany({
        where: { classroomId: { in: classroomIds }, ...(opts.status ? { status: opts.status } : {}) },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      });
      return rows.map(toAssignment);
    }
    return (fallbackStore.assignments as any[])
      .filter((a) => classroomIds.includes(a.classroomId) && (!opts.status || a.status === opts.status))
      .map(toAssignment);
  },

  async setAssignmentStatus(id: string, status: string): Promise<AssignmentRecord | null> {
    if (dbMode()) {
      try {
        return toAssignment(await prisma.assignment.update({ where: { id }, data: { status } }));
      } catch (e: any) {
        if (e?.code === "P2025") return null;
        throw e;
      }
    }
    const rec = (fallbackStore.assignments as any[]).find((a) => a.id === id);
    if (!rec) return null;
    rec.status = status;
    rec.updatedAt = new Date();
    return toAssignment(rec);
  },
};

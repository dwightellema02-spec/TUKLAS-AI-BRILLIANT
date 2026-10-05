/**
 * Phase 25: Classroom rules and authorization.
 *
 * Principles:
 *  - A teacher only ever touches classes they own (admins: all). Everything is checked here, not in routes.
 *  - A teacher is "authorized for a student" only through an ACTIVE class that student is enrolled in.
 *  - Students join with a short code; failures are throttled and never say why a code failed.
 *  - Only existing STUDENT accounts can be enrolled; staff accounts are never disclosed or enrollable.
 */

import { dbService } from "../db";
import { checkLoginThrottle, clearLoginFailures, recordLoginFailure } from "../auth/login-throttle";
import { validateEmail } from "../auth/validation";
import { ClassroomRepo, normalizeJoinCode, type AssignmentRecord, type ClassroomRecord } from "./classroom-repo";

export class ClassroomError extends Error {
  constructor(message: string, public readonly status: 400 | 401 | 403 | 404 | 409 | 429) {
    super(message);
    this.name = "ClassroomError";
  }
}

export interface Actor {
  userId: string;
  role: string;
}

const MAX_CLASSES_PER_TEACHER = 30;
const MAX_STUDENTS_PER_CLASS = 80;
const MAX_EMAILS_PER_REQUEST = 60;

const isStaff = (a: Actor) => a.role === "TEACHER" || a.role === "ADMIN";

function cleanText(input: unknown, min: number, max: number, label: string): string {
  if (typeof input !== "string") throw new ClassroomError(`${label} is required`, 400);
  const t = input.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length < min || t.length > max) throw new ClassroomError(`${label} must be ${min}-${max} characters`, 400);
  return t;
}

export interface ClassroomView {
  id: string;
  name: string;
  gradeLevel: number;
  subject: string;
  schoolYear: string;
  teacherId: string;
  teacherName?: string;
  joinCode: string | null;
  joinCodeActive: boolean;
  archived: boolean;
  studentCount: number;
}

export const ClassroomService = {
  // ----------------------------------------------------------------------------------------
  // Authorization helpers
  // ----------------------------------------------------------------------------------------

  /** Load a class the actor may manage (owner or admin). 404 if missing, 403 if not theirs. */
  async getManageable(actor: Actor, classId: string): Promise<ClassroomRecord> {
    if (!isStaff(actor)) throw new ClassroomError("Forbidden: Teacher or Administrator access required.", 403);
    const cls = await ClassroomRepo.getById(classId);
    if (!cls) throw new ClassroomError("Classroom not found", 404);
    if (actor.role !== "ADMIN" && cls.teacherId !== actor.userId) {
      throw new ClassroomError("Forbidden: You do not teach this class.", 403);
    }
    return cls;
  },

  async isTeacherAuthorizedForStudent(teacherId: string, studentId: string, role: string): Promise<boolean> {
    if (role === "ADMIN") return true;
    if (role !== "TEACHER") return false;
    return ClassroomRepo.teacherHasStudent(teacherId, studentId);
  },

  // ----------------------------------------------------------------------------------------
  // Classes
  // ----------------------------------------------------------------------------------------
  async create(actor: Actor, input: { name: unknown; gradeLevel?: unknown; subject?: unknown; schoolYear?: unknown }): Promise<ClassroomView> {
    if (!isStaff(actor)) throw new ClassroomError("Forbidden: Teacher or Administrator access required.", 403);
    const name = cleanText(input.name, 2, 80, "Class name");
    const gradeLevel = input.gradeLevel === undefined ? 7 : Number(input.gradeLevel);
    if (!Number.isInteger(gradeLevel) || gradeLevel < 1 || gradeLevel > 12) throw new ClassroomError("Grade level must be between 1 and 12", 400);
    const subject = input.subject === undefined ? "Mathematics" : cleanText(input.subject, 2, 60, "Subject");
    const schoolYear = input.schoolYear === undefined ? "2026-2027" : cleanText(input.schoolYear, 4, 20, "School year");

    if ((await ClassroomRepo.countForTeacher(actor.userId)) >= MAX_CLASSES_PER_TEACHER) {
      throw new ClassroomError(`A teacher can have at most ${MAX_CLASSES_PER_TEACHER} active classes. Archive one first.`, 409);
    }
    const cls = await ClassroomRepo.create({ teacherId: actor.userId, name, gradeLevel, subject, schoolYear });
    return this.toView(cls, 0);
  },

  async toView(cls: ClassroomRecord, studentCount: number, teacherName?: string): Promise<ClassroomView> {
    return {
      id: cls.id,
      name: cls.name,
      gradeLevel: cls.gradeLevel,
      subject: cls.subject,
      schoolYear: cls.schoolYear,
      teacherId: cls.teacherId,
      teacherName,
      joinCode: cls.joinCode,
      joinCodeActive: cls.joinCodeActive,
      archived: !!cls.archivedAt,
      studentCount,
    };
  },

  /** Classes the actor manages (admin: all active classes). */
  async listManaged(actor: Actor, opts: { includeArchived?: boolean } = {}): Promise<ClassroomView[]> {
    if (!isStaff(actor)) throw new ClassroomError("Forbidden: Teacher or Administrator access required.", 403);
    const classes = await ClassroomRepo.listForTeacher(actor.role === "ADMIN" ? null : actor.userId, opts);
    const enrollments = await ClassroomRepo.listEnrollments(classes.map((c) => c.id));
    return Promise.all(
      classes.map((c) => this.toView(c, enrollments.filter((e) => e.classroomId === c.id).length))
    );
  },

  async update(actor: Actor, classId: string, patch: { name?: unknown; joinCodeActive?: unknown; archived?: unknown }): Promise<ClassroomView> {
    const cls = await this.getManageable(actor, classId);
    const data: Parameters<typeof ClassroomRepo.update>[1] = {};
    if (patch.name !== undefined) data.name = cleanText(patch.name, 2, 80, "Class name");
    if (patch.joinCodeActive !== undefined) data.joinCodeActive = Boolean(patch.joinCodeActive);
    if (patch.archived !== undefined) data.archivedAt = patch.archived ? new Date() : null;
    const updated = await ClassroomRepo.update(cls.id, data);
    if (!updated) throw new ClassroomError("Classroom not found", 404);
    const n = (await ClassroomRepo.listEnrollments([cls.id])).length;
    return this.toView(updated, n);
  },

  async regenerateJoinCode(actor: Actor, classId: string): Promise<ClassroomView> {
    const cls = await this.getManageable(actor, classId);
    const updated = await ClassroomRepo.regenerateJoinCode(cls.id);
    if (!updated) throw new ClassroomError("Classroom not found", 404);
    const n = (await ClassroomRepo.listEnrollments([cls.id])).length;
    return this.toView(updated, n);
  },

  /** Legacy classes created before join codes existed get one the first time a manager opens them. */
  async ensureJoinCode(cls: ClassroomRecord): Promise<ClassroomRecord> {
    if (cls.joinCode) return cls;
    return (await ClassroomRepo.regenerateJoinCode(cls.id)) ?? cls;
  },

  // ----------------------------------------------------------------------------------------
  // Roster
  // ----------------------------------------------------------------------------------------
  async addStudentsByEmail(actor: Actor, classId: string, emails: unknown): Promise<Array<{ email: string; status: "ADDED" | "ALREADY_ENROLLED" | "NO_STUDENT_ACCOUNT" | "INVALID_EMAIL" | "CLASS_FULL" }>> {
    const cls = await this.getManageable(actor, classId);
    if (cls.archivedAt) throw new ClassroomError("This class is archived. Restore it to change the roster.", 409);
    if (!Array.isArray(emails) || emails.length === 0) throw new ClassroomError("Provide at least one student email", 400);
    if (emails.length > MAX_EMAILS_PER_REQUEST) throw new ClassroomError(`At most ${MAX_EMAILS_PER_REQUEST} emails per request`, 400);

    const source = actor.role === "ADMIN" ? "ADMIN" : "TEACHER";
    let count = (await ClassroomRepo.listEnrollments([cls.id])).length;
    const results: Array<{ email: string; status: "ADDED" | "ALREADY_ENROLLED" | "NO_STUDENT_ACCOUNT" | "INVALID_EMAIL" | "CLASS_FULL" }> = [];
    const seen = new Set<string>();

    for (const raw of emails) {
      let email: string;
      try {
        email = validateEmail(raw);
      } catch {
        results.push({ email: String(raw).slice(0, 120), status: "INVALID_EMAIL" });
        continue;
      }
      if (seen.has(email)) continue;
      seen.add(email);

      const user = await dbService.findUserByEmail(email);
      // Staff accounts are indistinguishable from "no such account": a teacher cannot probe who is an admin.
      if (!user || user.role !== "STUDENT") {
        results.push({ email, status: "NO_STUDENT_ACCOUNT" });
        continue;
      }
      if (count >= MAX_STUDENTS_PER_CLASS) {
        results.push({ email, status: "CLASS_FULL" });
        continue;
      }
      const { created } = await ClassroomRepo.addEnrollment(cls.id, user.id, source);
      if (created) count++;
      results.push({ email, status: created ? "ADDED" : "ALREADY_ENROLLED" });
    }
    return results;
  },

  async removeStudent(actor: Actor, classId: string, studentId: string): Promise<boolean> {
    const cls = await this.getManageable(actor, classId);
    return ClassroomRepo.removeEnrollment(cls.id, studentId);
  },

  // ----------------------------------------------------------------------------------------
  // Student side
  // ----------------------------------------------------------------------------------------
  async joinByCode(student: Actor, rawCode: unknown, clientIp: string): Promise<ClassroomView> {
    if (student.role !== "STUDENT") throw new ClassroomError("Only student accounts can join a class with a code.", 403);

    const keys = [`join-user:${student.userId}`, `join-ip:${clientIp}`];
    const gate = checkLoginThrottle(keys);
    if (!gate.allowed) throw new ClassroomError("Too many attempts. Please wait a few minutes and try again.", 429);

    const code = normalizeJoinCode(rawCode);
    const cls = code ? await ClassroomRepo.getByJoinCode(code) : null;
    // One generic failure for: malformed, unknown, switched-off, or archived. Never reveals which.
    if (!cls || !cls.joinCodeActive || cls.archivedAt) {
      recordLoginFailure(keys);
      throw new ClassroomError("That class code is not valid. Check it with your teacher.", 404);
    }
    const count = (await ClassroomRepo.listEnrollments([cls.id])).length;
    const existing = (await ClassroomRepo.listEnrollmentsForStudent(student.userId)).some((e) => e.classroomId === cls.id);
    if (!existing && count >= MAX_STUDENTS_PER_CLASS) throw new ClassroomError("This class is full. Ask your teacher.", 409);

    await ClassroomRepo.addEnrollment(cls.id, student.userId, "JOIN_CODE");
    clearLoginFailures([keys[0]]);
    const teacher = await dbService.findUserById(cls.teacherId);
    return this.toView({ ...cls, joinCode: null }, count + (existing ? 0 : 1), teacher?.name);
  },

  /** A student's own active classes. The join code is never included. */
  async listForStudent(student: Actor): Promise<ClassroomView[]> {
    const enrollments = await ClassroomRepo.listEnrollmentsForStudent(student.userId);
    const out: ClassroomView[] = [];
    for (const e of enrollments) {
      const cls = await ClassroomRepo.getById(e.classroomId);
      if (!cls || cls.archivedAt) continue;
      const teacher = await dbService.findUserById(cls.teacherId);
      out.push(await this.toView({ ...cls, joinCode: null }, 0, teacher?.name));
    }
    return out;
  },

  async leave(student: Actor, classId: string): Promise<boolean> {
    return ClassroomRepo.removeEnrollment(classId, student.userId);
  },

  // ----------------------------------------------------------------------------------------
  // Assignments
  // ----------------------------------------------------------------------------------------
  async createAssignment(
    actor: Actor,
    classId: string,
    input: { title?: unknown; description?: unknown; lessonId?: unknown; practiceSetId?: unknown; dueDate?: unknown }
  ): Promise<AssignmentRecord> {
    const cls = await this.getManageable(actor, classId);
    if (cls.archivedAt) throw new ClassroomError("This class is archived.", 409);
    const title = cleanText(input.title, 2, 120, "Assignment title");
    const description = input.description === undefined || input.description === null || input.description === "" ? null : cleanText(input.description, 1, 1000, "Description");

    let lessonId: string | null = null;
    if (input.lessonId) {
      if (typeof input.lessonId !== "string") throw new ClassroomError("Invalid lesson", 400);
      const lesson = await dbService.getLessonById(input.lessonId);
      if (!lesson) throw new ClassroomError("Lesson not found", 404);
      // Students are only ever sent to lessons they can open.
      if (lesson.status !== "PUBLISHED") throw new ClassroomError("Only published lessons can be assigned.", 409);
      lessonId = lesson.id;
    }
    let practiceSetId: string | null = null;
    if (input.practiceSetId) {
      if (typeof input.practiceSetId !== "string") throw new ClassroomError("Invalid practice set", 400);
      const set = await dbService.getPracticeSetById(input.practiceSetId);
      if (!set) throw new ClassroomError("Practice set not found", 404);
      practiceSetId = set.id;
    }
    if (!lessonId && !practiceSetId) throw new ClassroomError("Choose a lesson or a practice set to assign.", 400);

    let dueDate: Date | null = null;
    if (input.dueDate) {
      const d = new Date(String(input.dueDate));
      if (Number.isNaN(d.getTime())) throw new ClassroomError("Invalid due date", 400);
      if (d.getTime() > Date.now() + 2 * 365 * 24 * 3600 * 1000) throw new ClassroomError("Due date is too far in the future", 400);
      dueDate = d;
    }
    return ClassroomRepo.createAssignment({ classroomId: cls.id, title, description, lessonId, practiceSetId, dueDate, createdById: actor.userId });
  },

  async listAssignmentsForClass(actor: Actor, classId: string): Promise<AssignmentRecord[]> {
    const cls = await this.getManageable(actor, classId);
    return ClassroomRepo.listAssignments([cls.id]);
  },

  async setAssignmentStatus(actor: Actor, assignmentId: string, status: unknown): Promise<AssignmentRecord> {
    if (status !== "PUBLISHED" && status !== "ARCHIVED") throw new ClassroomError("Status must be PUBLISHED or ARCHIVED", 400);
    const a = await ClassroomRepo.getAssignment(assignmentId);
    if (!a) throw new ClassroomError("Assignment not found", 404);
    await this.getManageable(actor, a.classroomId); // ownership via the class
    const updated = await ClassroomRepo.setAssignmentStatus(assignmentId, status);
    if (!updated) throw new ClassroomError("Assignment not found", 404);
    return updated;
  },

  /** Published assignments in the student's active classes, with the student's own progress on each. */
  async listAssignmentsForStudent(student: Actor) {
    const enrollments = await ClassroomRepo.listEnrollmentsForStudent(student.userId);
    const activeClasses: ClassroomRecord[] = [];
    for (const e of enrollments) {
      const c = await ClassroomRepo.getById(e.classroomId);
      if (c && !c.archivedAt) activeClasses.push(c);
    }
    const assignments = await ClassroomRepo.listAssignments(activeClasses.map((c) => c.id), { status: "PUBLISHED" });
    const progress = (await dbService.getStudentProgress(student.userId)) as any[];

    return Promise.all(
      assignments.map(async (a) => {
        const cls = activeClasses.find((c) => c.id === a.classroomId)!;
        const lesson = a.lessonId ? await dbService.getLessonById(a.lessonId) : null;
        const prog = a.lessonId ? progress.find((p) => p.lessonId === a.lessonId) : undefined;
        const state = !a.lessonId ? "NOT_TRACKED" : !prog ? "NOT_STARTED" : prog.status === "COMPLETED" || (prog.progressPercentage ?? 0) >= 100 ? "COMPLETED" : "IN_PROGRESS";
        return {
          id: a.id,
          title: a.title,
          description: a.description,
          classroomId: cls.id,
          classroomName: cls.name,
          lessonId: a.lessonId,
          lessonTitle: lesson?.title ?? null,
          practiceSetId: a.practiceSetId,
          dueDate: a.dueDate,
          state,
        };
      })
    );
  },
};

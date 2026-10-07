/**
 * Phase 45: saving a lesson draft is all-or-nothing. If any section fails to save, the lesson that was already created is removed, so a
 * teacher never finds a half-imported lesson.
 */
import type { LessonDraft } from "./lesson-draft";

export interface DraftStore {
  createLesson(data: { title: string; description?: string; unitId: string; authorId?: string; learningObjectives: string[]; estimatedMinutes?: number; skillIds?: string[] }): Promise<any>;
  addContentBlock(lessonId: string, data: { type: any; title?: string; content: string; metadata?: string }): Promise<any>;
  deleteLesson(id: string, role: any): Promise<any>;
}

export interface SavedDraft { lessonId: string; blocks: Array<{ id: string; type: string; title: string; characters: number }> }

export async function saveLessonDraft(store: DraftStore, draft: LessonDraft, params: { unitId: string; authorId: string }): Promise<SavedDraft> {
  const lesson = await store.createLesson({
    title: draft.title,
    description: "",
    unitId: params.unitId,
    authorId: params.authorId,
    learningObjectives: draft.objectives,
    estimatedMinutes: Math.min(120, Math.max(10, Math.round(draft.stats.characters / 900) * 5 || 20)),
    skillIds: [],
  });
  const blocks: SavedDraft["blocks"] = [];
  try {
    for (const b of draft.blocks) {
      const saved = await store.addContentBlock(lesson.id, { type: b.type, title: b.title, content: b.content });
      blocks.push({ id: saved.id, type: b.type, title: b.title, characters: b.content.length });
    }
  } catch (e) {
    await store.deleteLesson(lesson.id, "ADMIN").catch(() => undefined);
    throw e;
  }
  return { lessonId: lesson.id, blocks };
}

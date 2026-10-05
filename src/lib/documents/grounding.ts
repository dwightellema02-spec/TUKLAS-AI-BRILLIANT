/**
 * Phase 22: Permission-aware retrieval that grounds the AI Tutor in real lesson material.
 *
 * Authorization is enforced HERE (fail closed): a student only retrieves from lessons that are
 * PUBLISHED and unlocked for them. Answer-key chunks and chunks that contain the student's current
 * question verbatim are never returned.
 */

import { dbService } from "../db";
import { bm25Rank, type Retrievable } from "./retrieve";
import type { GroundingSource } from "./types";

/** Block types whose content is explanatory lesson material (assessment-type blocks may hold answers). */
const RETRIEVABLE_BLOCK_TYPES = new Set(["TEXT", "EXAMPLE", "SUMMARY", "HINT"]);

const MAX_SOURCE_CHARS = 1000;

export interface ResourceInventoryItem {
  title: string;
  kind: "DOCUMENT" | "TEACHER_NOTE" | "VIDEO" | "OTHER";
  /** Whether the tutor actually has readable text from this resource. */
  readable: boolean;
  detail: string;
}

export interface TutorGrounding {
  sources: GroundingSource[];
  inventory: ResourceInventoryItem[];
}

export const EMPTY_GROUNDING: TutorGrounding = { sources: [], inventory: [] };

function normalizeForCompare(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\-+*/=<>]/g, "");
}

/** Neutralize delimiter forgery so retrieved text cannot close the quoted-source block. */
export function sanitizeSourceText(text: string): string {
  return text
    .replace(/```/g, "'''")
    .replace(/=== ?(END )?SOURCE[^=]*===/gi, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, MAX_SOURCE_CHARS);
}

function blockPlainText(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const strings: string[] = [];
      const walk = (v: unknown, key?: string) => {
        if (typeof v === "string") {
          if (!key || !/answer|correct|solution|key/i.test(key)) strings.push(v);
        } else if (Array.isArray(v)) v.forEach((x) => walk(x));
        else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, k));
      };
      walk(JSON.parse(trimmed));
      return strings.join("\n");
    } catch {
      /* not JSON, fall through */
    }
  }
  return content;
}

export async function isLessonAccessibleToStudent(studentId: string, lessonId: string): Promise<boolean> {
  try {
    const lesson = await dbService.getLessonById(lessonId);
    if (!lesson || lesson.status !== "PUBLISHED") return false;
    const access = await dbService.getLessonAccess(studentId, lessonId);
    return Boolean(access.allowed);
  } catch {
    return false; // fail closed
  }
}

export async function retrieveTutorGrounding(params: {
  studentId: string;
  lessonId?: string;
  query: string;
  questionPrompt?: string;
  topK?: number;
}): Promise<TutorGrounding> {
  const { studentId, lessonId, query, questionPrompt, topK = 3 } = params;
  if (!lessonId) return EMPTY_GROUNDING;
  if (!(await isLessonAccessibleToStudent(studentId, lessonId))) return EMPTY_GROUNDING;

  const lesson = await dbService.getLessonById(lessonId);
  if (!lesson) return EMPTY_GROUNDING;

  type Candidate = Retrievable & {
    origin: GroundingSource["origin"];
    sectionLabel: string;
    pageStart?: number;
    displayTitle: string;
  };
  const candidates: Candidate[] = [];

  const chunks = await dbService.getLessonChunks(lessonId, { includeAnswerKeys: false });
  for (const c of chunks) {
    candidates.push({
      id: c.id,
      title: `${c.resourceTitle} ${c.sectionLabel}`,
      text: c.text,
      origin: c.resourceType === "TEACHER_NOTE" ? "TEACHER_NOTE" : "DOCUMENT",
      sectionLabel: c.sectionLabel,
      pageStart: c.pageStart,
      displayTitle: c.resourceTitle,
    });
  }

  for (const block of lesson.contentBlocks || []) {
    if (!RETRIEVABLE_BLOCK_TYPES.has(String(block.type))) continue;
    const text = blockPlainText(block.content || "");
    if (!text.trim()) continue;
    candidates.push({
      id: `blk:${block.id}`,
      title: block.title || "Lesson content",
      text,
      origin: "LESSON_BLOCK",
      sectionLabel: block.title || "Lesson content",
      displayTitle: lesson.title,
    });
  }

  // Drop anything that contains the current question verbatim (it may be the solved problem).
  const qNorm = questionPrompt ? normalizeForCompare(questionPrompt) : "";
  const eligible =
    qNorm.length >= 15 ? candidates.filter((c) => !normalizeForCompare(c.text).includes(qNorm)) : candidates;

  // The query combines what the student said with the current question, so vague messages
  // ("I don't get it") still retrieve material about the question being worked on.
  const searchText = `${query || ""} ${questionPrompt || ""} ${lesson.title}`;
  const ranked = bm25Rank(searchText, eligible, { topK });

  const sources: GroundingSource[] = ranked.map((r, i) => ({
    sourceId: `S${i + 1}`,
    origin: r.item.origin,
    title: r.item.displayTitle || "Lesson material",
    sectionLabel: r.item.sectionLabel,
    pageStart: r.item.pageStart,
    text: sanitizeSourceText(r.item.text),
    score: Math.round(r.score * 100) / 100,
  }));

  // Honest inventory of what the tutor can and cannot actually read.
  const inventory: ResourceInventoryItem[] = [];
  for (const r of lesson.resources || []) {
    if (r.type === "YOUTUBE") {
      inventory.push({
        title: r.title,
        kind: "VIDEO",
        readable: false,
        detail: "Video: only its title/metadata is known. No transcript is available; its content has NOT been watched or read.",
      });
    } else if (r.type === "PDF" || r.type === "DOCUMENT" || r.type === "TEACHER_NOTE") {
      const status = r.extractionStatus;
      const readable = status === "EXTRACTED" || status === "TRUNCATED";
      inventory.push({
        title: r.title,
        kind: r.type === "TEACHER_NOTE" ? "TEACHER_NOTE" : "DOCUMENT",
        readable,
        detail: readable
          ? status === "TRUNCATED"
            ? "Readable, but only the first part of this large document was indexed."
            : "Readable text is available."
          : `NOT readable by the tutor (${status || "not processed"}). Do not claim to know its contents.`,
      });
    } else {
      inventory.push({ title: r.title, kind: "OTHER", readable: false, detail: "Attached resource; its content is not available to the tutor." });
    }
  }

  return { sources, inventory };
}

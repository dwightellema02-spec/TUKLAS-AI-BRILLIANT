/**
 * Phase 45: turn an uploaded lesson document (DOCX / PDF / TXT) into a DRAFT lesson a teacher then reviews and edits in the studio.
 *
 * Rules:
 *  - Nothing is invented. Every section is the document's own text, only split at headings and paragraph breaks.
 *  - Answer keys and teacher-only sections are NEVER imported (a student could read them); the result says what was left out.
 *  - Practice sections are kept as text and flagged: the importer does not create or grade questions.
 *  - Images are not imported; the result says how many were left out.
 *  - Size limits keep one upload from creating an unreadable lesson.
 */
import { cleanPages } from "./clean";
import { ExtractionError, extractRaw } from "./extract";
import { DOCUMENT_LIMITS, type DocumentKind } from "./types";

export const DRAFT_LIMITS = { MAX_BLOCKS: 40, MAX_BLOCK_CHARS: 6000, MAX_OBJECTIVES: 8, MAX_OBJECTIVE_CHARS: 300, MAX_TITLE_CHARS: 200 } as const;

export type DraftBlockType = "TEXT" | "EXAMPLE" | "SUMMARY";
export interface DraftBlock { type: DraftBlockType; title: string; content: string }
export interface SkippedSection { title: string; reason: string }
export interface LessonDraft {
  title: string;
  objectives: string[];
  blocks: DraftBlock[];
  skipped: SkippedSection[];
  warnings: string[];
  stats: { sections: number; characters: number; pages: number; imagesNotImported: number };
}
export type DraftOutcome = { ok: true; draft: LessonDraft } | { ok: false; status: 422; error: string };

const OBJECTIVES = /^(?:(?:learning|lesson)\s+)?(?:objectives?|targets?|competenc(?:y|ies)|outcomes?|goals?)\b|^i can\b|^by the end of\b/i;
const ANSWER_KEY = /^(?:answer\s*keys?|answers?(?:\s+(?:key|sheet))?|solutions?(?:\s+(?:manual|key))?|teacher'?s?\s+(?:guide|notes?|edition|copy)|for\s+the\s+teacher|rubric)\b/i;
const EXAMPLE = /^(?:(?:worked|sample|solved)\s+)?(?:example|illustration|sample\s+problem)\b/i;
const PRACTICE = /^(?:practice|exercises?|activit(?:y|ies)|try\s+(?:it|this)|your\s+turn|drills?|quiz|assessment|evaluation|let'?s\s+practice|problem\s+set)\b/i;
const SUMMARY = /^(?:summary|key\s+(?:points|ideas|takeaways?|concepts)|remember|recap|wrap[\s-]?up|in\s+a\s+nutshell)\b/i;
const KEYWORD_START = /^(?:lesson|objectives?|introduction|example|worked|sample|practice|exercises?|activit|try|your\s+turn|summary|key|remember|recap|answer|solution|discussion|definition|explore|engage|explain|elaborate|evaluate|reflection|let'?s)\b/i;

const isLetter = (c: string) => /[A-Za-zÀ-ɏ]/.test(c);

/** A line that opens a section: a Word heading ("# " from the extractor), or a short stand-alone line that looks like a title. */
function headingOf(line: string, prevBlank: boolean, nextExists: boolean, firstLine = false, nextBlank = false): string | undefined {
  const t = line.trim();
  if (!t) return undefined;
  if (/^#{1,6}\s+\S/.test(t)) return t.replace(/^#{1,6}\s+/, "").replace(/\s*\|\s*$/, "").trim();
  if (firstLine && nextExists && nextBlank && t.length <= 100 && t.split(/\s+/).length >= 2 && !/[.?!,;:]$/.test(t) && [...t].filter(isLetter).length >= 5) return t; // a plain-text title
  if (!prevBlank || !nextExists) return undefined;
  if (t.length > 80 || t.length < 3) return undefined;
  const letters = [...t].filter(isLetter).length;
  if (letters < 3 || letters / t.length < 0.55) return undefined; // "5 + 3 = 8" is not a title
  if (/[?!]$/.test(t)) return undefined; // a question line
  const body = t.replace(/[:\s]+$/, "");
  const upper = letters >= 4 && body === body.toUpperCase();
  const numbered = /^\d+(?:\.\d+)*[.)]\s+[A-Z]/.test(body) && !/[.;,]$/.test(body);
  const keyword = KEYWORD_START.test(body) && body.split(/\s+/).length <= 12 && !/[.;,]$/.test(body);
  return upper || numbered || keyword ? body : undefined;
}

const stripBullet = (s: string) => s.replace(/^\s*(?:[-*•●▪]|\d+[.)]|[a-z][.)])\s+/i, "").trim();

function splitLong(title: string, text: string, max: number): Array<{ title: string; content: string }> {
  if (text.length <= max) return [{ title, content: text }];
  const parts: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    if (para.length > max) {
      if (current) { parts.push(current); current = ""; }
      let rest = para;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(". ", max);
        if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
        if (cut <= 0) cut = max;
        parts.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
      }
      current = rest;
      continue;
    }
    if (current && current.length + para.length + 2 > max) { parts.push(current); current = para; }
    else current = current ? `${current}\n\n${para}` : para;
  }
  if (current) parts.push(current);
  return parts.map((content, i) => ({ title: i === 0 ? title : `${title} (part ${i + 1})`, content }));
}

const questionLike = (line: string) => /\?\s*$/.test(line) || /^\s*(?:\d+[.)]|[A-Za-z][.)])\s+\S/.test(line) || /^\s*problem\s+[A-Za-z0-9]+\s*:/i.test(line);

/** Builds the draft from already-cleaned page text. Pure: no I/O. */
export function buildLessonDraft(pages: string[], opts: { fileName?: string; title?: string; pageCount?: number; imageCount?: number } = {}): LessonDraft {
  const text = pages.join("\n\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const lines = text.split("\n");
  type Section = { heading?: string; lines: string[] };
  const sections: Section[] = [{ lines: [] }];
  for (let i = 0; i < lines.length; i++) {
    const prevBlank = i === 0 || lines[i - 1].trim() === "";
    const next = lines.slice(i + 1).find((l) => l.trim() !== "");
    const isFirst = lines.slice(0, i).every((l) => l.trim() === "");
    const h = headingOf(lines[i], prevBlank, next !== undefined, isFirst, (lines[i + 1] ?? "").trim() === "");
    if (h) sections.push({ heading: h, lines: [] });
    else sections[sections.length - 1].lines.push(lines[i]);
  }

  const warnings: string[] = [];
  const skipped: SkippedSection[] = [];
  const objectives: string[] = [];
  const blocks: DraftBlock[] = [];

  // A first heading that is not itself a lesson part (Objectives, Example ...) is the lesson's title.
  let title = (opts.title ?? "").replace(/\s+/g, " ").trim();
  const first = sections[1];
  const isPart = (h: string) => OBJECTIVES.test(h) || ANSWER_KEY.test(h) || EXAMPLE.test(h) || PRACTICE.test(h) || SUMMARY.test(h);
  if (!title && first?.heading && sections[0].lines.join("").trim() === "" && !isPart(first.heading) && sections.length > 2) {
    title = first.heading;
    if (first.lines.join("").trim()) sections[1] = { heading: "Introduction", lines: first.lines };
    else sections.splice(1, 1);
  }
  if (!title) {
    const base = (opts.fileName ?? "").replace(/\.[A-Za-z0-9]{2,5}$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    title = base || "Imported lesson";
    warnings.push("The document does not start with a clear title, so the file name was used. Please check the lesson title.");
  }
  title = title.slice(0, DRAFT_LIMITS.MAX_TITLE_CHARS);

  for (const sec of sections) {
    const body = sec.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const shown = sec.heading && sec.heading.length > 3 && sec.heading === sec.heading.toUpperCase() ? sec.heading.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_m, a, b) => a + b.toUpperCase()) : sec.heading;
    const heading = shown ?? (blocks.length === 0 && !objectives.length ? "Introduction" : "Notes");
    if (!body) continue;
    if (sec.heading && ANSWER_KEY.test(sec.heading)) {
      skipped.push({ title: sec.heading, reason: "Answer keys and teacher-only sections are never imported, because students could read them." });
      continue;
    }
    if (sec.heading && OBJECTIVES.test(sec.heading)) {
      for (const l of body.split("\n")) {
        const o = stripBullet(l);
        if (o.length >= 5 && objectives.length < DRAFT_LIMITS.MAX_OBJECTIVES) objectives.push(o.slice(0, DRAFT_LIMITS.MAX_OBJECTIVE_CHARS));
      }
      continue;
    }
    if (body.replace(/\s/g, "").length < 15) { skipped.push({ title: heading, reason: "Almost empty, so it was left out." }); continue; }
    let type: DraftBlockType = "TEXT";
    if (sec.heading && EXAMPLE.test(sec.heading)) type = "EXAMPLE";
    else if (sec.heading && SUMMARY.test(sec.heading)) type = "SUMMARY";
    else if (sec.heading && PRACTICE.test(sec.heading)) {
      const n = body.split("\n").filter(questionLike).length;
      warnings.push(`"${heading}" is imported as plain text${n ? ` (${n} question-like line${n === 1 ? "" : "s"})` : ""}. The importer does not create questions: add them in the studio so students get instant feedback and the tutor can help.`);
    }
    for (const part of splitLong(heading, body, DRAFT_LIMITS.MAX_BLOCK_CHARS)) blocks.push({ type, title: part.title.slice(0, 200), content: part.content });
  }

  if (blocks.length > DRAFT_LIMITS.MAX_BLOCKS) {
    warnings.push(`The document made ${blocks.length} sections; only the first ${DRAFT_LIMITS.MAX_BLOCKS} were imported. Split it into several lessons.`);
    blocks.length = DRAFT_LIMITS.MAX_BLOCKS;
  }
  if (blocks.length === 1 && blocks[0].content.length > 1500 && !sections.some((x, i) => i > 0 && x.heading)) warnings.push("No section headings were found, so the whole document is one section. Word files with Heading styles import best; split the section in the studio.");
  if (objectives.length === 0) warnings.push("No learning objectives were found. Add them before publishing.");
  if ((opts.imageCount ?? 0) > 0) warnings.push(`${opts.imageCount} image${opts.imageCount === 1 ? " was" : "s were"} not imported. Add pictures in the studio.`);
  if (blocks.some((b) => b.content.includes("$"))) warnings.push('Some text contains "$", which the lesson page shows as maths when it appears in pairs. Check how it displays.');
  const characters = blocks.reduce((n, b) => n + b.content.length, 0);
  return { title, objectives, blocks, skipped, warnings, stats: { sections: blocks.length, characters, pages: opts.pageCount ?? pages.length, imagesNotImported: opts.imageCount ?? 0 } };
}

/** Extract + clean + build. Never throws for a bad file: the reason comes back for the teacher. */
export async function draftLessonFromDocument(buffer: Buffer, kind: DocumentKind, opts: { fileName?: string; title?: string } = {}): Promise<DraftOutcome> {
  let raw;
  try {
    raw = await extractRaw(buffer, kind);
  } catch (e) {
    return { ok: false, status: 422, error: e instanceof ExtractionError ? e.message : "The document could not be read." };
  }
  let pages = cleanPages(raw.pages);
  const total = pages.reduce((n, p) => n + p.length, 0);
  if (total === 0) {
    return { ok: false, status: 422, error: kind === "PDF" ? "No readable text was found. This PDF looks scanned or image-only, and OCR is not enabled. Upload a text-based PDF or a Word file." : "The document contains no text." };
  }
  if (kind === "PDF" && total / Math.max(raw.pageCount, 1) < DOCUMENT_LIMITS.MIN_CHARS_PER_PAGE_FOR_TEXT) {
    return { ok: false, status: 422, error: "Almost no readable text was found. This PDF looks scanned or image-only, and OCR is not enabled. Upload a text-based PDF or a Word file." };
  }
  let truncated = raw.pageCount > raw.pages.length;
  if (total > DOCUMENT_LIMITS.MAX_EXTRACTED_CHARS) {
    truncated = true;
    let budget = DOCUMENT_LIMITS.MAX_EXTRACTED_CHARS;
    pages = pages.map((p) => { const s = p.slice(0, Math.max(budget, 0)); budget -= s.length; return s; });
  }
  const draft = buildLessonDraft(pages, { ...opts, pageCount: raw.pageCount, imageCount: raw.imageCount });
  if (truncated) draft.warnings.push("The document is very large; only the first part was read.");
  if (draft.blocks.length === 0) return { ok: false, status: 422, error: "No lesson sections could be found in this document. Check that it contains the lesson text, not only an answer key." };
  return { ok: true, draft };
}

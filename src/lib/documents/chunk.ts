/**
 * Phase 22: Structure-aware chunking.
 * Splits on headings/paragraphs, targets ~TARGET_CHARS per chunk, records page spans and a
 * human-readable section label so answers can cite their source.
 */

import { DOCUMENT_LIMITS, type DocumentChunk } from "./types";

const TARGET_CHARS = 900;
const MAX_CHARS = 1400;

const ANSWER_KEY_HEADING = /^\s*#?\s*(answer\s*keys?|key\s+to\s+(correction|answers)|answers?|solutions?|teacher'?s?\s+(guide|key)|scoring\s+guide)\b/i;

interface Segment {
  text: string;
  page: number;
  heading?: string;
}

const HEADING_KEYWORDS =
  "answer\\s*keys?|key to (?:correction|answers)|solutions?|lesson|activity|module|quarter|week|day|objectives?|learning (?:objectives|competenc\\w+)|key (?:points|concepts)|let'?s (?:try|explore)|what'?s (?:new|more|in)|what i (?:know|have learned)|assessment|reflection|summary|practice|examples?|exercises?";
// A keyword line, optionally numbered/lettered, optionally followed by ": title". Whole-line match.
const KEYWORD_HEADING = new RegExp(`^(?:${HEADING_KEYWORDS})(?:\\s+(?:\\d+|[IVXivx]+|[A-Z]))?\\s*(?::.{0,60})?$`, "i");

function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.startsWith("# ")) return true;
  if (t.length < 3 || t.length > 80) return false;
  if (/[.?!,;]$/.test(t)) return false;
  if (KEYWORD_HEADING.test(t) && /^[A-Z0-9]/.test(t)) return true;
  // ALL-CAPS short line (letters only, not a pure math expression)
  return t === t.toUpperCase() && /[A-Z]{3,}/.test(t);
}

function splitLongParagraph(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const sentences = text.match(/[^.!?\n]+[.!?]+(\s|$)|[^.!?\n]+$/g) || [text];
  const parts: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > MAX_CHARS && buf.length > 0) {
      parts.push(buf.trim());
      buf = "";
    }
    // A single enormous "sentence" (e.g. no punctuation): hard split.
    if (s.length > MAX_CHARS) {
      for (let i = 0; i < s.length; i += MAX_CHARS) parts.push(s.slice(i, i + MAX_CHARS).trim());
    } else {
      buf += s;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

export function chunkPages(pages: string[]): { chunks: DocumentChunk[]; truncated: boolean } {
  const segments: Segment[] = [];
  let currentHeading: string | undefined;

  pages.forEach((pageText, pageIdx) => {
    let para: string[] = [];
    const flushPara = () => {
      const text = para.join("\n").trim();
      para = [];
      if (!text) return;
      for (const piece of splitLongParagraph(text)) {
        segments.push({ text: piece, page: pageIdx + 1, heading: currentHeading });
      }
    };
    // Line-based: PDFs rarely contain blank lines between paragraphs, so headings must be found per line.
    for (const line of pageText.split("\n")) {
      if (line.trim().length === 0) {
        flushPara();
      } else if (looksLikeHeading(line)) {
        flushPara();
        currentHeading = line.replace(/^#\s*/, "").trim();
      } else {
        para.push(line);
      }
    }
    flushPara();
  });

  const chunks: DocumentChunk[] = [];
  let truncated = false;
  let buf: Segment[] = [];
  let bufLen = 0;

  const flush = () => {
    if (buf.length === 0) return;
    const heading = buf[0].heading;
    const pageStart = buf[0].page;
    const pageEnd = buf[buf.length - 1].page;
    const text = buf.map((s) => s.text).join("\n\n");
    const label = heading
      ? pages.length > 1
        ? `${heading} (p. ${pageStart})`
        : heading
      : pages.length > 1
        ? `Page ${pageStart}`
        : "Document";
    chunks.push({
      ordinal: chunks.length,
      text,
      sectionLabel: label,
      pageStart,
      pageEnd,
      isAnswerKey: Boolean(
        (heading && ANSWER_KEY_HEADING.test(heading)) || ANSWER_KEY_HEADING.test(text.split("\n")[0])
      ),
    });
    buf = [];
    bufLen = 0;
  };

  for (const seg of segments) {
    if (chunks.length >= DOCUMENT_LIMITS.MAX_CHUNKS_PER_DOCUMENT) {
      truncated = true;
      break;
    }
    const headingChanged = buf.length > 0 && buf[0].heading !== seg.heading;
    if (headingChanged || (bufLen + seg.text.length > TARGET_CHARS && bufLen > 0)) flush();
    buf.push(seg);
    bufLen += seg.text.length;
  }
  if (!truncated) flush();

  // Once an answer-key heading starts, everything under it stays flagged until a different
  // non-answer heading appears; handled implicitly because chunks split on heading change.
  return { chunks, truncated };
}

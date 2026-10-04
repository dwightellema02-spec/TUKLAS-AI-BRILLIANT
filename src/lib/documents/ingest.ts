/**
 * Phase 22: Ingestion pipeline  VALIDATE -> EXTRACT -> CLEAN -> CHUNK  (storage/index done by caller).
 */

import crypto from "crypto";
import { cleanPages } from "./clean";
import { chunkPages } from "./chunk";
import { ExtractionError, extractRaw } from "./extract";
import { DOCUMENT_LIMITS, type DocumentKind, type IngestResult } from "./types";

export function hashContent(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function ingestDocument(buffer: Buffer, kind: DocumentKind): Promise<IngestResult> {
  const contentHash = hashContent(buffer);

  let raw;
  try {
    raw = await extractRaw(buffer, kind);
  } catch (e) {
    const message = e instanceof ExtractionError ? e.message : "The document could not be read.";
    return { status: "FAILED", error: message, charCount: 0, contentHash, chunks: [] };
  }

  let pages = cleanPages(raw.pages);
  const totalChars = pages.reduce((a, p) => a + p.length, 0);

  // Image-only / scanned detection (PDF only: other formats have no "image-only" notion).
  if (kind === "PDF") {
    const avg = totalChars / Math.max(raw.pageCount, 1);
    if (totalChars === 0 || avg < DOCUMENT_LIMITS.MIN_CHARS_PER_PAGE_FOR_TEXT) {
      return {
        status: "NO_TEXT",
        error:
          "No readable text was found. This PDF appears to be scanned or image-only. OCR is not enabled, so the AI Tutor cannot use this file. Upload a text-based PDF or DOCX, or add the key content as a teacher note.",
        pageCount: raw.pageCount,
        charCount: totalChars,
        contentHash,
        chunks: [],
      };
    }
  } else if (totalChars === 0) {
    return {
      status: "NO_TEXT",
      error: "The document contains no text.",
      pageCount: raw.pageCount,
      charCount: 0,
      contentHash,
      chunks: [],
    };
  }

  let truncated = raw.pageCount > raw.pages.length;
  if (totalChars > DOCUMENT_LIMITS.MAX_EXTRACTED_CHARS) {
    truncated = true;
    let budget = DOCUMENT_LIMITS.MAX_EXTRACTED_CHARS;
    pages = pages.map((p) => {
      const slice = p.slice(0, Math.max(budget, 0));
      budget -= slice.length;
      return slice;
    });
  }

  const { chunks, truncated: chunkTruncated } = chunkPages(pages);
  truncated = truncated || chunkTruncated;

  if (chunks.length === 0) {
    return {
      status: "NO_TEXT",
      error: "The document contains no usable text after cleaning.",
      pageCount: raw.pageCount,
      charCount: 0,
      contentHash,
      chunks: [],
    };
  }

  return {
    status: truncated ? "TRUNCATED" : "EXTRACTED",
    error: truncated
      ? "This document is very large. Only the first portion was indexed; the AI Tutor can only use that portion."
      : undefined,
    pageCount: raw.pageCount,
    charCount: pages.reduce((a, p) => a + p.length, 0),
    contentHash,
    chunks,
  };
}

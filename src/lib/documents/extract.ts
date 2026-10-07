/**
 * Phase 22: Real text extraction for PDF, DOCX and TXT.
 * Extraction never fabricates content: failures and image-only files are reported as such.
 */

import mammoth from "mammoth";
import { getDocumentProxy, extractText } from "unpdf";
import { DOCUMENT_LIMITS, type DocumentKind, type RawExtraction } from "./types";

export class ExtractionError extends Error {
  constructor(message: string, public readonly code: "ENCRYPTED" | "CORRUPT" | "TIMEOUT" | "UNSUPPORTED") {
    super(message);
    this.name = "ExtractionError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ExtractionError(`${label} timed out after ${Math.round(ms / 1000)}s.`, "TIMEOUT")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function extractPdf(buffer: Buffer): Promise<RawExtraction> {
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    // Copy: pdf.js transfers/detaches the underlying ArrayBuffer.
    pdf = await getDocumentProxy(new Uint8Array(buffer));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/password/i.test(msg)) {
      throw new ExtractionError("The PDF is password-protected and cannot be read.", "ENCRYPTED");
    }
    throw new ExtractionError("The PDF could not be parsed (it may be corrupted).", "CORRUPT");
  }

  const pageCount = pdf.numPages;
  if (pageCount > DOCUMENT_LIMITS.MAX_PDF_PAGES) {
    // Read only the first MAX pages; the caller marks the result TRUNCATED.
    const { text } = await withTimeout(
      extractText(pdf, { mergePages: false }),
      DOCUMENT_LIMITS.EXTRACTION_TIMEOUT_MS,
      "PDF extraction"
    );
    return { pages: (text as string[]).slice(0, DOCUMENT_LIMITS.MAX_PDF_PAGES), pageCount };
  }

  const { text } = await withTimeout(
    extractText(pdf, { mergePages: false }),
    DOCUMENT_LIMITS.EXTRACTION_TIMEOUT_MS,
    "PDF extraction"
  );
  return { pages: text as string[], pageCount };
}

const HEADING_TAG = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

function htmlToStructuredText(html: string): string {
  return html
    .replace(HEADING_TAG, (_m, _lvl, inner) => `\n\n# ${stripTags(inner)}\n\n`)
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

async function extractDocx(buffer: Buffer): Promise<RawExtraction> {
  try {
    const result = await withTimeout(
      mammoth.convertToHtml({ buffer }),
      DOCUMENT_LIMITS.EXTRACTION_TIMEOUT_MS,
      "DOCX extraction"
    );
    return { pages: [htmlToStructuredText(result.value)], pageCount: 1, imageCount: (result.value.match(/<img\b/gi) ?? []).length };
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    throw new ExtractionError("The DOCX file could not be parsed (it may be corrupted).", "CORRUPT");
  }
}

function extractTxt(buffer: Buffer): RawExtraction {
  // Strip a UTF-8 BOM if present.
  const text = buffer.toString("utf-8").replace(/^﻿/, "");
  return { pages: [text], pageCount: 1 };
}

export async function extractRaw(buffer: Buffer, kind: DocumentKind): Promise<RawExtraction> {
  switch (kind) {
    case "PDF":
      return extractPdf(buffer);
    case "DOCX":
      return extractDocx(buffer);
    case "TXT":
      return extractTxt(buffer);
    default:
      throw new ExtractionError(`Unsupported document kind: ${String(kind)}`, "UNSUPPORTED");
  }
}

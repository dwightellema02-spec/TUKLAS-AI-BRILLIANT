/**
 * Phase 22: Document Intelligence shared types.
 */

export type DocumentKind = "PDF" | "DOCX" | "TXT";

export type ExtractionStatus =
  | "EXTRACTED" // text extracted and indexed
  | "NO_TEXT" // file is valid but has no extractable text (e.g. scanned PDF)
  | "FAILED" // parser error (corrupt/encrypted/unsupported internals)
  | "TRUNCATED"; // extracted, but the document exceeded size limits and was cut off

/** Output of a format-specific extractor: one entry per page (DOCX/TXT are a single "page"). */
export interface RawExtraction {
  pages: string[];
  pageCount: number;
}

export interface DocumentChunk {
  ordinal: number;
  text: string;
  sectionLabel: string;
  pageStart?: number;
  pageEnd?: number;
  /** True if the chunk looks like an answer key / solutions section. Never retrieved for students. */
  isAnswerKey: boolean;
}

export interface IngestResult {
  status: ExtractionStatus;
  error?: string;
  pageCount?: number;
  charCount: number;
  contentHash: string;
  chunks: DocumentChunk[];
}

export interface StoredChunk extends DocumentChunk {
  id: string;
  resourceId: string;
  lessonId: string;
}

/** A retrieved piece of grounding material, addressable by the tutor as [S#]. */
export interface GroundingSource {
  sourceId: string; // "S1", "S2", ...
  origin: "DOCUMENT" | "TEACHER_NOTE" | "LESSON_BLOCK";
  title: string; // resource or block title
  sectionLabel: string;
  pageStart?: number;
  text: string;
  score: number;
}

export interface SourceCitation {
  sourceId: string;
  title: string;
  sectionLabel: string;
  page?: number;
}

export const DOCUMENT_LIMITS = {
  MAX_FILE_BYTES: 25 * 1024 * 1024,
  MAX_PDF_PAGES: 300,
  MAX_EXTRACTED_CHARS: 1_500_000,
  MAX_CHUNKS_PER_DOCUMENT: 2000,
  /** DOCX is a zip: guard against decompression bombs. */
  MAX_DOCX_ENTRIES: 2000,
  MAX_DOCX_UNCOMPRESSED_BYTES: 100 * 1024 * 1024,
  MAX_DOCX_COMPRESSION_RATIO: 200,
  EXTRACTION_TIMEOUT_MS: 30_000,
  /** Fewer average characters per page than this => treat PDF as image-only/scanned. */
  MIN_CHARS_PER_PAGE_FOR_TEXT: 25,
} as const;

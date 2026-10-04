/**
 * Phase 22: Server-side upload validation.
 * Never trusts the client-declared MIME type or the extension alone: the file's magic bytes
 * must agree with the extension, and DOCX archives are inspected for decompression bombs.
 */

import JSZip from "jszip";
import { DOCUMENT_LIMITS, type DocumentKind } from "./types";

export interface ValidationOk {
  ok: true;
  kind: DocumentKind;
  safeFileName: string;
}
export interface ValidationFail {
  ok: false;
  error: string;
  status: 400 | 413 | 415;
}

const EXTENSION_KIND: Record<string, DocumentKind> = {
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
};

export function sanitizeFileName(name: string): string {
  const base = (name || "").split(/[\\/]/).pop() || "document";
  const cleaned = base
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[^\p{L}\p{N}._ \-()]/gu, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return cleaned || "document";
}

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

function looksLikeText(buf: Buffer): boolean {
  const sample = buf.subarray(0, Math.min(buf.length, 4096));
  for (const byte of sample) {
    // NUL or most C0 control chars (except tab, LF, CR, FF) mean binary content.
    if (byte === 0 || (byte < 9) || (byte > 13 && byte < 32)) return false;
  }
  return true;
}

export async function validateUpload(buffer: Buffer, rawFileName: string): Promise<ValidationOk | ValidationFail> {
  const safeFileName = sanitizeFileName(rawFileName);

  if (!buffer || buffer.length === 0) {
    return { ok: false, status: 400, error: "The uploaded file is empty." };
  }
  if (buffer.length > DOCUMENT_LIMITS.MAX_FILE_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `File size exceeds the ${DOCUMENT_LIMITS.MAX_FILE_BYTES / (1024 * 1024)}MB limit (current: ${(buffer.length / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  const kind = EXTENSION_KIND[extensionOf(safeFileName)];
  if (!kind) {
    return {
      ok: false,
      status: 415,
      error: `Unsupported file format (.${extensionOf(safeFileName) || "unknown"}). Supported formats: PDF, DOCX, TXT.`,
    };
  }

  if (kind === "PDF") {
    // %PDF- may be preceded by a few bytes of junk in the first 1024 bytes per the spec.
    if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) {
      return { ok: false, status: 415, error: "File content is not a valid PDF (missing PDF header)." };
    }
  } else if (kind === "DOCX") {
    if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
      return { ok: false, status: 415, error: "File content is not a valid DOCX (not a ZIP container)." };
    }
    const zipCheck = await inspectDocxArchive(buffer);
    if (!zipCheck.ok) return zipCheck;
  } else if (kind === "TXT") {
    if (!looksLikeText(buffer)) {
      return { ok: false, status: 415, error: "File content does not look like plain text." };
    }
  }

  return { ok: true, kind, safeFileName };
}

async function inspectDocxArchive(buffer: Buffer): Promise<{ ok: true } | ValidationFail> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return { ok: false, status: 415, error: "DOCX archive is corrupted and cannot be opened." };
  }

  const entries = Object.values(zip.files);
  if (entries.length > DOCUMENT_LIMITS.MAX_DOCX_ENTRIES) {
    return { ok: false, status: 400, error: "DOCX archive contains too many entries." };
  }
  if (!zip.file("word/document.xml")) {
    return { ok: false, status: 415, error: "File is a ZIP archive but not a Word document (word/document.xml missing)." };
  }

  // JSZip exposes the declared uncompressed size on the internal entry data.
  let totalUncompressed = 0;
  for (const entry of entries) {
    const declared = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    totalUncompressed += declared;
  }
  if (totalUncompressed > DOCUMENT_LIMITS.MAX_DOCX_UNCOMPRESSED_BYTES) {
    return { ok: false, status: 413, error: "DOCX expands to an unsafe size and was rejected." };
  }
  if (buffer.length > 0 && totalUncompressed / buffer.length > DOCUMENT_LIMITS.MAX_DOCX_COMPRESSION_RATIO) {
    return { ok: false, status: 413, error: "DOCX compression ratio is suspiciously high and was rejected." };
  }
  return { ok: true };
}

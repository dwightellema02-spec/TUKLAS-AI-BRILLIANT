/**
 * Storage Abstraction & Document Resource Architecture
 * Client-side metadata pre-check for PDF, DOCX and TXT. The authoritative validation (magic bytes,
 * archive inspection) happens server-side in src/lib/documents/validate.ts.
 * Large binary files are decoupled from PostgreSQL into object storage abstraction.
 */

export interface DocumentMetadata {
  fileName: string;
  fileType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | string;
  fileSize: number; // In bytes
  storagePath: string;
  publicUrl?: string;
}

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "text/plain", // .txt
];

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export function validateDocumentMetadata(file: {
  name: string;
  type: string;
  size: number;
}): { isValid: boolean; error?: string } {
  if (!file.name) {
    return { isValid: false, error: "Document must have a filename." };
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const allowedExtensions = ["pdf", "docx", "txt"];

  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      isValid: false,
      error: `Unsupported file format (.${extension}). Only PDF, DOCX, and TXT are supported.`,
    };
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return {
      isValid: false,
      error: `File size exceeds the 25MB limit (current: ${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  return { isValid: true };
}

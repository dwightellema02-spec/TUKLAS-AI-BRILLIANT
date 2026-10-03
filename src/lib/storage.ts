/**
 * Storage Abstraction & Document Resource Architecture
 * Handles metadata validation and storage provider decoupling for PDFs, DOCX, and PPTX.
 * Large binary files are decoupled from PostgreSQL into object storage abstraction.
 */

export interface DocumentMetadata {
  fileName: string;
  fileType: "application/pdf" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "application/vnd.openxmlformats-officedocument.presentationml.presentation" | string;
  fileSize: number; // In bytes
  storagePath: string;
  publicUrl?: string;
}

export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/msword", // .doc
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
  const allowedExtensions = ["pdf", "docx", "pptx", "doc"];

  if (!extension || !allowedExtensions.includes(extension)) {
    return {
      isValid: false,
      error: `Unsupported file format (.${extension}). Only PDF, DOCX, and PPTX are supported.`,
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

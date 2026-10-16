/**
 * Phase 22: Private on-disk storage for uploaded originals.
 * Files are stored under random names OUTSIDE any statically-served directory and are never
 * addressable by client-supplied paths. Swap this module for an object-storage adapter in production
 * deployments with ephemeral disks.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

/**
 * Phase 48: a serverless host (Vercel) has a read-only disk and no memory between requests, so originals cannot be kept there. The text
 * extracted from a document is stored in the database either way (that is what the AI tutor reads); only the original file is skipped.
 * STORE_ORIGINALS=false does the same anywhere; STORE_ORIGINALS=true forces storing.
 */
export function originalsAreKept(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.STORE_ORIGINALS === "true") return true;
  if (env.STORE_ORIGINALS === "false") return false;
  return !env.VERCEL;
}

/** The largest upload this host accepts. Vercel rejects request bodies over 4.5 MB before our code runs, so stay under it there. */
export function maxUploadBytes(env: NodeJS.ProcessEnv = process.env): number {
  const hard = 25 * 1024 * 1024;
  const cap = Number(env.MAX_UPLOAD_BYTES);
  if (Number.isFinite(cap) && cap >= 1024 && cap <= hard) return cap;
  return env.VERCEL ? 4 * 1024 * 1024 : hard;
}

const STORAGE_ROOT = path.resolve(process.env.DOCUMENT_STORAGE_DIR || path.join(process.cwd(), "storage", "documents"));

export function saveOriginal(buffer: Buffer, extension: string): string | undefined {
  if (!originalsAreKept()) return undefined;
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  const safeExt = extension.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  const key = `${crypto.randomUUID()}.${safeExt}`;
  fs.writeFileSync(path.join(STORAGE_ROOT, key), buffer, { mode: 0o600 });
  return key;
}

/** Resolve a storage key to a path, refusing anything that escapes the storage root. */
function resolveKey(key: string): string | null {
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{1,8}$/.test(key)) return null;
  const full = path.resolve(STORAGE_ROOT, key);
  return full.startsWith(STORAGE_ROOT + path.sep) ? full : null;
}

export function deleteOriginal(key: string | undefined | null): void {
  if (!key) return;
  const full = resolveKey(key);
  if (!full) return;
  try {
    fs.unlinkSync(full);
  } catch {
    /* already gone */
  }
}

export function readOriginal(key: string): Buffer | null {
  const full = resolveKey(key);
  if (!full || !fs.existsSync(full)) return null;
  return fs.readFileSync(full);
}

/**
 * Phase 22: Private on-disk storage for uploaded originals.
 * Files are stored under random names OUTSIDE any statically-served directory and are never
 * addressable by client-supplied paths. Swap this module for an object-storage adapter in production
 * deployments with ephemeral disks.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const STORAGE_ROOT = path.resolve(process.env.DOCUMENT_STORAGE_DIR || path.join(process.cwd(), "storage", "documents"));

export function saveOriginal(buffer: Buffer, extension: string): string {
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

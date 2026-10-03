/**
 * Password Security Utility
 * Bcrypt salt and hash functions for secure credential storage.
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(
  plainText: string,
  hashed: string
): Promise<boolean> {
  return bcrypt.compare(plainText, hashed);
}

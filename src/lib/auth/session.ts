/**
 * Session & Token Management Utility
 * Cryptographically signed session tokens for secure HTTP-only cookie and bearer auth.
 */

import crypto from "crypto";
import { UserRole } from "@prisma/client";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

const SECRET = process.env.AUTH_SECRET || "tuklas_ai_phase2_dev_secret_key_minimum_32_bytes";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function signData(dataString: string): string {
  return crypto.createHmac("sha256", SECRET).update(dataString).digest("base64url");
}

export function createSessionToken(user: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}): string {
  const now = Date.now();
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signData(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) return null;

    const expectedSignature = signData(encodedPayload);
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8")
    );

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

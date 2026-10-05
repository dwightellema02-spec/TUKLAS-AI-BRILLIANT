/**
 * Authentication & Input Validation
 * Validates registration, login, and curricular data.
 */

import { UserRole } from "@prisma/client";

export function validateEmail(email: unknown): string {
  if (typeof email !== "string") throw new Error("Email must be a string");
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error("Invalid email address format");
  }
  return trimmed;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== "string") throw new Error("Password must be a string");
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }
  return password;
}

/**
 * Policy for NEW passwords (registration, admin-created accounts, password change).
 * Login keeps the lenient check above so existing accounts are never locked out by a policy change.
 */
export function validateNewPassword(password: unknown): string {
  if (typeof password !== "string") throw new Error("Password must be a string");
  if (password.length < 8) throw new Error("Password must be at least 8 characters long");
  if (password.length > 128) throw new Error("Password must be at most 128 characters long");
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Password must contain at least one letter and one number");
  }
  return password;
}

export function validateRole(role: unknown): UserRole {
  const validRoles: UserRole[] = ["STUDENT", "TEACHER", "ADMIN", "RESEARCHER"];
  if (typeof role !== "string" || !validRoles.includes(role as UserRole)) {
    return "STUDENT";
  }
  return role as UserRole;
}

export function validateName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Name is required");
  }
  return name.trim();
}

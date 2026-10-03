/**
 * Utility helpers for Tuklas AI
 */

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatGradeTerm(grade: string, term: string): string {
  return `${grade} • ${term}`;
}

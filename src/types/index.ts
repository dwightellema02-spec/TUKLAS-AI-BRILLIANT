/**
 * Tuklas AI - Foundation Domain Types (Phase 1)
 * Lightweight structural types without premature database modeling.
 */

export type UserRole = "STUDENT" | "TEACHER" | "ADMIN" | "RESEARCHER";

export type LearningStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "NEEDS_REMEDITATION";

export type MasteryLevel =
  | "NOT_STARTED"
  | "LEARNING"
  | "DEVELOPING"
  | "PROFICIENT"
  | "MASTERED";

export interface CurriculumPreviewUnit {
  id: string;
  term: number;
  termTitle: string;
  topics: string[];
}

export interface FeatureCard {
  id: string;
  title: string;
  tagline: string;
  description: string;
  iconName: string;
  statusBadge?: string;
}

export interface NavigationRoute {
  path: string;
  label: string;
  description?: string;
  roleRequired?: UserRole;
}

/**
 * Role-Based Access Control (RBAC) System
 * Defines permissions and path boundaries across STUDENT, TEACHER, and ADMIN roles.
 */

import { UserRole } from "@prisma/client";

export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    allowedRoutes: string[];
    canManageCurriculum: boolean;
    canReviewStudents: boolean;
    canAccessAdmin: boolean;
  }
> = {
  STUDENT: {
    allowedRoutes: ["/", "/student"],
    canManageCurriculum: false,
    canReviewStudents: false,
    canAccessAdmin: false,
  },
  TEACHER: {
    allowedRoutes: ["/", "/student", "/teacher"],
    canManageCurriculum: true,
    canReviewStudents: true,
    canAccessAdmin: false,
  },
  ADMIN: {
    allowedRoutes: ["/", "/student", "/teacher", "/admin"],
    canManageCurriculum: true,
    canReviewStudents: true,
    canAccessAdmin: true,
  },
  RESEARCHER: {
    allowedRoutes: ["/", "/student", "/admin"],
    canManageCurriculum: false,
    canReviewStudents: true,
    canAccessAdmin: false,
  },
};

export function canUserAccessPath(userRole: UserRole | undefined, path: string): boolean {
  // Public routes
  if (path === "/" || path === "/login" || path === "/register") {
    return true;
  }

  if (!userRole) return false;

  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return false;

  if (path.startsWith("/student")) {
    return permissions.allowedRoutes.includes("/student");
  }

  if (path.startsWith("/teacher")) {
    return permissions.allowedRoutes.includes("/teacher");
  }

  if (path.startsWith("/admin")) {
    return permissions.allowedRoutes.includes("/admin");
  }

  return true;
}

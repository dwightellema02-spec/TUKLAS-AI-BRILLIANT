/**
 * Tuklas AI - Core Application Configuration
 * Central source of truth for branding, metadata, and site navigation.
 */

export interface NavItem {
  title: string;
  href: string;
  badge?: string;
  isExternal?: boolean;
}

export interface SiteConfig {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  version: string;
  phase: string;
  initialScope: {
    subject: string;
    grade: string;
    curriculum: string;
    term: string;
  };
  mainNav: NavItem[];
  footerNav: {
    title: string;
    items: NavItem[];
  }[];
}

export const siteConfig: SiteConfig = {
  name: "Tuklas AI",
  shortName: "Tuklas",
  tagline: "Learn. Practice. Discover.",
  description:
    "An interactive learning platform designed to help students understand mathematical concepts, practice problem-solving, and track their learning progress.",
  version: "0.28.0-pilot",
  phase: "Pilot build",
  initialScope: {
    subject: "Mathematics",
    grade: "Grade 7",
    curriculum: "MATATAG",
    term: "Term 1",
  },
  mainNav: [
    { title: "Home", href: "/" },
    { title: "Learn", href: "/student" },
    { title: "For Students", href: "/student" },
    { title: "For Teachers", href: "/teacher" },
    { title: "Admin Portal", href: "/admin", badge: "Staff" },
  ],
  footerNav: [
    {
      title: "Learning",
      items: [
        { title: "Grade 7 Math (MATATAG)", href: "/student" },
        { title: "Interactive Lessons", href: "/student" },
        { title: "Practice Engine", href: "/student" },
      ],
    },
    {
      title: "Educators",
      items: [
        { title: "Teacher Dashboard", href: "/teacher" },
        { title: "Curriculum Alignment", href: "#curriculum" },
        { title: "Student Analytics", href: "/teacher" },
      ],
    },
    {
      title: "Administration",
      items: [
        { title: "Admin Portal", href: "/admin" },
        { title: "Architecture Docs", href: "#" },
      ],
    },
  ],
};

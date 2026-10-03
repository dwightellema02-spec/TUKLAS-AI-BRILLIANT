/**
 * Tuklas AI - YouTube & Mathisipan Integration Configuration
 * Phase 13: Mathisipan / YouTube Educational Video Integration
 *
 * Centralized configuration for educational video embedding,
 * channel verification, search limits, and curated MATATAG curriculum directory.
 */

export interface MathisipanCuratedVideo {
  id: string;
  videoId: string;
  title: string;
  description: string;
  channelName: string;
  channelId: string;
  channelHandle: string;
  gradeLevel: number;
  termNumber: number;
  unitCode: string;
  skillId?: string;
  duration: string;
  tags: string[];
}

export const YOUTUBE_CONFIG = {
  provider: "YOUTUBE" as const,
  mathisipan: {
    channelName: "Mathisipan",
    channelHandle: "@mathisipan",
    channelId: "UC_mathisipan_official_deped",
    attributionLabel: "Video source: Mathisipan",
    youtubeBaseUrl: "https://www.youtube.com",
    embedBaseUrl: "https://www.youtube-nocookie.com/embed",
    thumbnailBaseUrl: "https://img.youtube.com/vi",
  },
  search: {
    maxResults: 12,
    debounceMs: 350,
    cacheTtlMs: 10 * 60 * 1000, // 10 minutes memory cache
    defaultQuery: "Mathisipan Grade 7 Mathematics",
  },
  quotas: {
    maxQueriesPerMinute: 30,
  },
};

/**
 * Curated directory of approved Mathisipan MATATAG Mathematics videos.
 * Provides instant search and preview across Grade 7 to Grade 10 without
 * exhausting external YouTube Data API quotas.
 */
export const MATHISIPAN_CURATED_VIDEOS: MathisipanCuratedVideo[] = [
  // Grade 7 Term 1: Numbers & Algebraic Expressions
  {
    id: "mth_g7_01",
    videoId: "w7m3CgG6w9k",
    title: "Understanding Integers and the Number Line (Grade 7 Mathematics)",
    description: "Introduction to positive and negative integers, real-world models (elevation, temperature), and representation on a horizontal number line.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    skillId: "skl_01",
    duration: "12:45",
    tags: ["integers", "number line", "positive", "negative", "grade 7", "matatag"],
  },
  {
    id: "mth_g7_02",
    videoId: "B5q1yvV9Zk8",
    title: "Comparing and Ordering Integers: Number Line Strategies",
    description: "Step-by-step tutorial on comparing integers using greater than (>), less than (<), and ordering from least to greatest.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    skillId: "skl_02",
    duration: "10:15",
    tags: ["comparing integers", "ordering", "inequalities", "grade 7", "matatag"],
  },
  {
    id: "mth_g7_03",
    videoId: "k5uW2t9xL6E",
    title: "Addition of Integers: Same Signs and Different Signs",
    description: "Visual counter method and number line moves for adding integers with same and different signs.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    skillId: "skl_03",
    duration: "15:20",
    tags: ["adding integers", "counters", "zero pairs", "grade 7", "operations"],
  },
  {
    id: "mth_g7_04",
    videoId: "M8rK9p4q2Ds",
    title: "Subtraction of Integers: Adding the Additive Inverse",
    description: "Why subtracting a negative number is equivalent to adding a positive number. Conceptual and algebraic proofs made simple.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    skillId: "skl_04",
    duration: "14:10",
    tags: ["subtracting integers", "additive inverse", "opposite signs", "grade 7"],
  },
  {
    id: "mth_g7_05",
    videoId: "P3nB7m2xK9w",
    title: "Multiplication and Division of Signed Numbers",
    description: "Rules for multiplying and dividing integers. Sign patterns, pattern extension proofs, and word problems.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    duration: "13:30",
    tags: ["multiplying integers", "dividing integers", "sign rules", "grade 7"],
  },
  {
    id: "mth_g7_06",
    videoId: "T9vC4x8m2Qp",
    title: "Absolute Value and Distance on the Number Line",
    description: "Conceptual exploration of absolute value as geometric distance from zero. Why absolute value is never negative.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 7,
    termNumber: 1,
    unitCode: "unt_01",
    duration: "09:50",
    tags: ["absolute value", "distance", "modulus", "grade 7"],
  },

  // Grade 8 Mathematics
  {
    id: "mth_g8_01",
    videoId: "F7m2K9p4xQe",
    title: "Linear Equations in Two Variables: Slope and Intercepts",
    description: "Understanding slope, graph of linear equations, and finding x- and y-intercepts in Grade 8 Mathematics.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 8,
    termNumber: 1,
    unitCode: "unt_g8_01",
    duration: "16:40",
    tags: ["linear equations", "slope", "intercepts", "grade 8"],
  },
  {
    id: "mth_g8_02",
    videoId: "R5nB9x2m4Qt",
    title: "Systems of Linear Equations: Elimination and Substitution",
    description: "Solving systems of linear equations step by step using elimination, substitution, and graphical methods.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 8,
    termNumber: 1,
    unitCode: "unt_g8_01",
    duration: "18:15",
    tags: ["systems of equations", "elimination", "substitution", "grade 8"],
  },

  // Grade 9 Mathematics
  {
    id: "mth_g9_01",
    videoId: "H2m8K4p9xQw",
    title: "Quadratic Equations: Factoring and Quadratic Formula",
    description: "Solving quadratic equations by factoring, completing the square, and applying the quadratic formula.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 9,
    termNumber: 1,
    unitCode: "unt_g9_01",
    duration: "21:05",
    tags: ["quadratic equations", "factoring", "quadratic formula", "grade 9"],
  },

  // Grade 10 Mathematics
  {
    id: "mth_g10_01",
    videoId: "K9m4P2x7nQe",
    title: "Arithmetic and Geometric Sequences and Series",
    description: "Identifying nth term formulas for arithmetic and geometric sequences, common difference, common ratio, and finite series sums.",
    channelName: "Mathisipan",
    channelId: "UC_mathisipan_official_deped",
    channelHandle: "@mathisipan",
    gradeLevel: 10,
    termNumber: 1,
    unitCode: "unt_g10_01",
    duration: "19:30",
    tags: ["sequences", "arithmetic series", "geometric series", "grade 10"],
  },
];

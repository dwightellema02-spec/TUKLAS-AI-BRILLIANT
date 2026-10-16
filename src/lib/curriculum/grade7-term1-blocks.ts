/** Small builders for lesson blocks (shared by the Grade 7 Term 1 lesson files). Math in $...$ is rendered with KaTeX by the lesson player. */
import type { SeedBlock } from "./grade7-term1-types";

export const text = (title: string, content: string): SeedBlock => ({ type: "TEXT", title, content });
export const hint = (title: string, content: string): SeedBlock => ({ type: "HINT", title, content });
export const summary = (title: string, content: string): SeedBlock => ({ type: "SUMMARY", title, content });
export const image = (title: string, url: string, alt: string, caption: string): SeedBlock => ({ type: "IMAGE", title, content: caption, metadata: { url, alt, caption } });
export const example = (title: string, problem: string, steps: string[], answer: string): SeedBlock => ({
  type: "EXAMPLE", title,
  content: `Problem: ${problem}\n\n${steps.map((s, i) => `Step ${i + 1}: ${s}`).join("\n")}\n\nAnswer: ${answer}`,
  metadata: { problem, steps, answer },
});
export const check = (title: string, question: string, options: string[], correctAnswer: string, explanation: string): SeedBlock => ({
  type: "CHECKPOINT", title, content: question, metadata: { question, options, correctAnswer, explanation },
});
export const practice = (skillName: string, count: number): SeedBlock => ({
  type: "PRACTICE", title: "Practice what you learned", content: "Try the practice set for this lesson. Answer on your own first; the AI tutor is there to guide you if you get stuck.",
  metadata: { skillName, questionCount: count, difficulty: "Mixed" },
});

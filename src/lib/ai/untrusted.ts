/**
 * Untrusted text and prompts (master plan Module 21: prompt-injection defence).
 *
 * Anything a student, a teacher, a document or a file name wrote can end up inside the prompt sent to the model. The prompt is
 * organised with line-start markers ("### ...", "=== ...", "TUTOR:", a """ fence). If untrusted text could contain a line
 * that looks like one of those markers it could pretend to be part of the structure (a second TUTORING PLAN, a fake
 * evaluation, a fake end of the source block). These helpers make that impossible:
 *   - one-line fields (a student's message, an earlier answer, a title) are collapsed to a single line and quoted with JSON rules;
 *   - multi-line text (a document excerpt) keeps its lines, but any line that starts like a marker is defanged;
 *   - chat-template tokens ("<|im_start|>", "</system>") are removed.
 * Defanging is a safety net, not a guarantee: a model can still be talked into odd behaviour. The server decides correctness and
 * screens the output (answer disclosure, leaked instructions, links, markup) whatever the model was told.
 */

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏⁠﻿]/g;
const CHAT_TOKENS = /<\|[^|>]{0,40}\|>|<\/?(?:system|assistant|user|human|instructions?|prompt)\s*>|\[\/?(?:INST|SYS)\]|<<\/?SYS>>/gi;
const MARKER_LINE = /^(\s*)(#{1,6}(?=\s|$)|={3,}|"{3,}|`{3,}|-{3,}\s*$|(?:SYSTEM|TUTOR|STUDENT|ASSISTANT|USER|HUMAN|AI|MODEL)\s*:)/i;

/** A single-line, length-limited string with chat tokens removed. Not quoted. */
export function oneLine(text: unknown, max = 400): string {
  return String(text ?? "")
    .replace(CONTROL, "")
    .replace(CHAT_TOKENS, " ")
    .replace(/[\r\n\u2028\u2029]+/g, " ⏎ ")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, max);
}

/** A single-line, JSON-quoted string: quotes and backslashes cannot break out of it. */
export function quoted(text: unknown, max = 400): string {
  return JSON.stringify(oneLine(text, max));
}

/** Multi-line text where no line can pass as prompt structure. */
export function defang(text: unknown, max = 4000): string {
  return String(text ?? "")
    .replace(CONTROL, "")
    .replace(CHAT_TOKENS, " ")
    .slice(0, max)
    .split(/\r\n|\r|\n|\u2028|\u2029/)
    .map((line) => (MARKER_LINE.test(line) ? line.replace(MARKER_LINE, "$1› $2") : line))
    .join("\n");
}

/** Words that appear in a run of at least `n` words in both texts (case, punctuation and spacing ignored). */
export function sharesLongRun(output: string, source: string, n = 10): boolean {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9'$\\]+/g, " ").trim().split(" ").filter(Boolean);
  const o = words(output);
  const s = words(source);
  if (o.length < n || s.length < n) return false;
  const grams = new Set<string>();
  for (let i = 0; i + n <= s.length; i++) grams.add(s.slice(i, i + n).join(" "));
  for (let i = 0; i + n <= o.length; i++) if (grams.has(o.slice(i, i + n).join(" "))) return true;
  return false;
}

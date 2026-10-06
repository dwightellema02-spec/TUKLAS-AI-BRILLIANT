/** Text the section templates in the lesson studio start with. A lesson that still contains it cannot be published. */
export const TEMPLATE_MARK = "(Replace this text)";
export const TEMPLATE_MARK_RE = /\(replace this text\)/i;

/** The first section of a lesson that still has template text, if any (looks at its title, content and structured data). */
export function findUnfinishedBlock(blocks: Array<{ type?: string; title?: string | null; content?: string | null; metadata?: unknown }>): { title: string } | undefined {
  for (const b of blocks) {
    const meta = typeof b.metadata === "string" ? b.metadata : b.metadata ? JSON.stringify(b.metadata) : "";
    if (TEMPLATE_MARK_RE.test(`${b.title ?? ""} ${b.content ?? ""} ${meta}`)) return { title: b.title || "untitled" };
  }
  return undefined;
}

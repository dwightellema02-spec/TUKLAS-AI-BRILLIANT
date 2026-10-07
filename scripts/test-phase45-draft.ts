/**
 * Tuklas AI - Phase 45: building a draft lesson from a document. Pure logic on real Word/PDF/text fixtures; no server.
 *   npx tsx scripts/test-phase45-draft.ts
 */
import fs from "fs";
import path from "path";
import { draftLessonFromDocument, buildLessonDraft, DRAFT_LIMITS } from "../src/lib/documents/lesson-draft";
import { saveLessonDraft } from "../src/lib/documents/lesson-import-service";
import { validateUpload } from "../src/lib/documents";

let passed = 0, failed = 0;
const assert = (c: boolean, m: string) => { if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); } };
const section = (t: string) => console.log(`\n--- ${t} ---`);
const P45 = path.join(process.cwd(), "scripts", "fixtures", "phase45"), P22 = path.join(process.cwd(), "scripts", "fixtures", "phase22");
const fx = (dir: string, f: string) => fs.readFileSync(path.join(dir, f));
const KEY = "ZZ-ANSWER-KEY-7491";
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

async function main() {
  section("1. A structured Word lesson");
  const r = await draftLessonFromDocument(fx(P45, "lesson-structured.docx"), "DOCX", { fileName: "lesson-structured.docx" });
  assert(r.ok, "It is read");
  if (!r.ok) throw new Error(r.error);
  const d = r.draft;
  assert(d.title === "Subtracting Fractions with Unlike Denominators", `The title is the document's own first heading (${d.title})`);
  assert(d.objectives.length === 2 && /common denominator/.test(d.objectives[0]), "Learning objectives become the lesson's objectives, not a text section");
  assert(d.blocks.map((b) => b.type).join() === "TEXT,EXAMPLE,TEXT,SUMMARY" && d.blocks.map((b) => b.title).join("|") === "Introduction|Worked Example 1|Practice|Key Points", `Sections keep their order and kinds (${d.blocks.map((b) => b.type + ":" + b.title).join(", ")})`);
  assert(d.blocks.every((b) => !b.content.includes(KEY)) && d.skipped.some((s) => /answer key/i.test(s.title)), "The answer key is NOT imported and the result says it was left out");
  assert(d.warnings.some((w) => /Practice/.test(w) && /3 question-like/.test(w) && /does not create questions/.test(w)), "The practice section is flagged: 3 question-like lines, questions must be added in the studio");

  section("2. Nothing is invented");
  const source = norm((await (async () => { const m = await import("../src/lib/documents/extract"); const raw = await m.extractRaw(fx(P45, "lesson-structured.docx"), "DOCX"); return raw.pages.join(" "); })()));
  const everyBlockVerbatim = d.blocks.every((b) => norm(b.content).split(/(?<=[.?!])\s+/).every((sentence) => source.includes(norm(sentence).replace(/^#\s*/, ""))));
  assert(everyBlockVerbatim, "Every sentence of every section is found word for word in the source document");

  section("3. Plain text and PDF");
  const t = await draftLessonFromDocument(fx(P45, "lesson-plain.txt"), "TXT", { fileName: "lesson-plain.txt" });
  assert(t.ok && t.draft.title === "Percent of a Number" && t.draft.objectives.length === 2, "A plain-text title and objectives are found");
  if (t.ok) {
    assert(t.draft.blocks.map((b) => b.type).join() === "TEXT,EXAMPLE,TEXT,SUMMARY", `ALL-CAPS, keyword and numbered headings split the text (${t.draft.blocks.map((b) => b.title).join(" | ")})`);
    assert(t.draft.blocks.every((b) => !b.content.includes(KEY)) && t.draft.skipped.length === 1, "...and its answer key is left out");
    assert(t.draft.blocks.some((b) => b.title === "Introduction") && t.draft.blocks.some((b) => b.title === "Summary"), "ALL-CAPS headings are shown in normal case");
  }
  const pdf = await draftLessonFromDocument(fx(P22, "las-adding-integers.pdf"), "PDF", { fileName: "las.pdf" });
  assert(pdf.ok, "A text PDF is read");
  if (pdf.ok) assert(pdf.draft.blocks.length >= 1 && pdf.draft.blocks.every((b) => !/Problem A: -13/.test(b.content)), `...into ${pdf.draft.blocks.length} section(s) without its answer key`);

  section("4. Honest about what it could not do");
  const img = await draftLessonFromDocument(fx(P45, "lesson-with-image.docx"), "DOCX", { fileName: "x.docx" });
  assert(img.ok && img.draft.stats.imagesNotImported === 1 && img.draft.warnings.some((w) => /1 image was not imported/.test(w)), "A picture in the document is reported as not imported");
  const onlyKey = await draftLessonFromDocument(fx(P45, "only-answer-key.docx"), "DOCX", {});
  assert(!onlyKey.ok && /answer key/i.test((onlyKey as any).error), "A document that is only an answer key produces nothing, and says why");
  const scanned = await draftLessonFromDocument(fx(P22, "scanned-image-only.pdf"), "PDF", {});
  assert(!scanned.ok && /scanned|image-only/i.test((scanned as any).error), "A scanned PDF is refused with the reason (OCR is not enabled)");
  const empty = await draftLessonFromDocument(fx(P22, "empty.docx"), "DOCX", {});
  assert(!empty.ok, "An empty Word file is refused");
  const enc = await draftLessonFromDocument(fx(P22, "encrypted.pdf"), "PDF", {});
  assert(!enc.ok && /password/i.test((enc as any).error), "A password-protected PDF is refused with the reason");
  const garbage = await draftLessonFromDocument(Buffer.from("this is not a word file"), "DOCX", {});
  assert(!garbage.ok, "Garbage bytes named .docx are refused, not crashed on");
  assert(!(await validateUpload(fx(P22, "bomb.docx"), "bomb.docx")).ok, "A decompression bomb is rejected by the upload check that runs first");
  const named = await draftLessonFromDocument(fx(P45, "lesson-plain.txt"), "TXT", { fileName: "my_lesson-file.txt", title: "My own title" });
  assert(named.ok && named.draft.title === "My own title", "A title typed by the teacher wins");
  const noTitle = buildLessonDraft(["Just one paragraph of text without any headings at all. ".repeat(3)], { fileName: "q1_week-3_notes.docx" });
  assert(noTitle.title === "q1 week 3 notes" && noTitle.warnings.some((w) => /file name was used/.test(w)), "With no title in the document the file name is used, and the teacher is told");

  section("5. Limits");
  const many = await draftLessonFromDocument(fx(P45, "too-many-sections.docx"), "DOCX", {});
  assert(many.ok && many.draft.blocks.length === DRAFT_LIMITS.MAX_BLOCKS && many.draft.warnings.some((w) => /only the first 40/.test(w)), "45 sections: the first 40 are imported and the teacher is told");
  const long = await draftLessonFromDocument(fx(P45, "long-section.docx"), "DOCX", {});
  assert(long.ok && long.draft.blocks.length > 1 && long.draft.blocks.every((b) => b.content.length <= DRAFT_LIMITS.MAX_BLOCK_CHARS), `One giant section is split into ${long.ok ? long.draft.blocks.length : 0} readable parts, each within ${DRAFT_LIMITS.MAX_BLOCK_CHARS} characters`);
  if (long.ok) {
    const joined = long.draft.blocks.map((b) => b.content).join(" ");
    assert((joined.match(/Paragraph \d+\./g) ?? []).length === 119, "...and no paragraph is lost in the split (119 of 119)");
    assert(long.draft.blocks.slice(1).every((b, i) => b.title === `Explanation (part ${i + 2})`), "...the parts are numbered");
  }
  assert(buildLessonDraft(["Intro\u0000 text\u0007 with control chars that must go, long enough to be kept."], {}).blocks.every((b) => !/[\u0000-\u0008]/.test(b.content)), "Control characters never reach a lesson");
  assert(buildLessonDraft(["# Money\n\nA price of $5 and $7 is shown, long enough to keep as a section."], { title: "t" }).warnings.some((w) => /"\$"/.test(w)), 'Text with "$" gets a warning (the lesson page shows pairs of $ as maths)');

  section("6. Saving is all-or-nothing");
  const draft = (r as any).draft;
  const calls: string[] = [];
  const okStore: any = { createLesson: async () => { calls.push("create"); return { id: "L1" }; }, addContentBlock: async (_l: string, b: any) => { calls.push("block:" + b.title); return { id: "B" + calls.length }; }, deleteLesson: async () => { calls.push("delete"); } };
  const saved = await saveLessonDraft(okStore, draft, { unitId: "U", authorId: "T" });
  assert(saved.lessonId === "L1" && saved.blocks.length === 4 && !calls.includes("delete"), "A clean save creates the lesson and all 4 sections and deletes nothing");
  const failCalls: string[] = [];
  let n = 0;
  const failing: any = { createLesson: async () => { failCalls.push("create"); return { id: "L2" }; }, addContentBlock: async () => { if (++n === 3) throw new Error("disk full"); failCalls.push("block"); return { id: "x" }; }, deleteLesson: async (id: string) => { failCalls.push("delete:" + id); } };
  let threw = false;
  try { await saveLessonDraft(failing, draft, { unitId: "U", authorId: "T" }); } catch { threw = true; }
  assert(threw && failCalls.join() === "create,block,block,delete:L2", `When the 3rd section fails the lesson is removed again (${failCalls.join(" > ")})`);

  console.log(`\nPHASE 45 DRAFT RESULTS: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
main().catch((e) => { console.error("crashed:", e); process.exit(1); });

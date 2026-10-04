/**
 * Tuklas AI - Phase 22: PostgreSQL (Prisma) persistence path for documents and chunks.
 *
 * Needs a Postgres DATABASE_URL with the schema applied (`npx prisma db push`) and at least one seeded lesson.
 * Skips (exit 0, clearly labelled) when DATABASE_URL is not Postgres, so it cannot be mistaken for a pass.
 */
import fs from "fs";
import path from "path";

async function main() {
  const { hasValidDatabaseUrl, dbService, prisma } = await import("../src/lib/db");
  if (!hasValidDatabaseUrl) {
    console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script.");
    return;
  }
  const { ingestDocument, validateUpload } = await import("../src/lib/documents/index");
  const { retrieveTutorGrounding } = await import("../src/lib/documents/grounding");

  let passed = 0;
  let failed = 0;
  const assert = (c: boolean, m: string) => {
    if (c) {
      passed++;
      console.log(`  ✅ ${m}`);
    } else {
      failed++;
      console.error(`  ❌ FAILED: ${m}`);
    }
  };

  const lessons = await prisma.lesson.findMany({ include: { author: true }, take: 5 });
  const lesson = lessons.find((l) => l.authorId);
  if (!lesson) throw new Error("No seeded lesson with an author; run the seed first.");
  const teacherId = lesson.authorId!;
  console.log(`Using lesson "${lesson.title}" (${lesson.id}) authored by ${teacherId}`);

  const buf = fs.readFileSync(path.join(process.cwd(), "scripts/fixtures/phase22/las-adding-integers.docx"));
  const v = await validateUpload(buf, "las.docx");
  if (!v.ok) throw new Error(v.error);
  const ingest = await ingestDocument(buf, v.kind);

  const resource: any = await dbService.addLessonDocumentResource(lesson.id, "TEACHER", teacherId, {
    type: "DOCUMENT",
    title: "PG LAS Adding Integers",
    fileName: "las.docx",
    fileSize: buf.length,
    ingest,
  });
  assert(!!resource.id && resource.extractionStatus === "EXTRACTED", "Resource row written to PostgreSQL with extraction metadata");
  assert(resource.contentHash === ingest.contentHash && resource.pageCount === ingest.pageCount, "Hash and page count persisted");

  const rowCount = await prisma.resourceChunk.count({ where: { resourceId: resource.id } });
  assert(rowCount === ingest.chunks.length && rowCount > 0, `Chunks persisted (${rowCount})`);

  const visible = await dbService.getLessonChunks(lesson.id);
  assert(visible.length > 0 && visible.every((c) => !c.isAnswerKey), "getLessonChunks excludes answer-key chunks by default");
  const all = await dbService.getLessonChunks(lesson.id, { includeAnswerKeys: true });
  assert(all.some((c) => c.isAnswerKey), "includeAnswerKeys returns flagged chunks (teacher view)");
  assert(visible.every((c) => c.resourceTitle.length > 0), "Chunks are joined with resource titles");

  let forbidden = false;
  try {
    await dbService.addLessonDocumentResource(lesson.id, "TEACHER", "someone-else", { type: "DOCUMENT", title: "x", ingest });
  } catch (e) {
    forbidden = /Forbidden/.test(String(e));
  }
  assert(forbidden, "A different teacher is refused (ownership enforced on the PostgreSQL path)");

  const second: any = await dbService.createLesson({
    title: "PG second lesson",
    unitId: lesson.unitId,
    authorId: teacherId,
    learningObjectives: [],
    estimatedMinutes: 5,
    skillIds: [],
  });
  const wrong = await dbService.removeLessonResource(second.id, resource.id, "TEACHER", teacherId);
  assert(wrong.success === false, "Resource cannot be removed through a different lesson id (scoped delete)");
  assert((await prisma.lessonResource.count({ where: { id: resource.id } })) === 1, "Resource survived the cross-lesson delete attempt");

  const lessonView: any = await dbService.getLessonById(lesson.id);
  assert(lessonView.resources.some((r: any) => r.id === resource.id && r.extractionStatus === "EXTRACTED"), "getLessonById returns resources with extraction fields");

  const removed = await dbService.removeLessonResource(lesson.id, resource.id, "TEACHER", teacherId);
  assert(removed.success === true, "Resource removed");
  assert((await prisma.resourceChunk.count({ where: { resourceId: resource.id } })) === 0, "Chunks cascade-deleted with the resource");

  await prisma.lesson.delete({ where: { id: second.id } });

  console.log(`\nPOSTGRES PATH RESULTS: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Crashed:", e);
    process.exit(1);
  });

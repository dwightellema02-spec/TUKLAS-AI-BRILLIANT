/**
 * Tuklas AI - Phase 23: PostgreSQL (Prisma) path for tutor conversation state, ordering and flags.
 * Needs a Postgres DATABASE_URL with the schema applied and a seeded student + lesson. Skips otherwise.
 */
process.env.AI_PROVIDER = "local";

async function main() {
  const { hasValidDatabaseUrl, dbService, prisma } = await import("../src/lib/db");
  if (!hasValidDatabaseUrl) {
    console.log("SKIPPED: DATABASE_URL is not a PostgreSQL URL. Nothing was verified by this script.");
    return;
  }
  const { AITutorService } = await import("../src/lib/ai/tutor");
  const { parseState } = await import("../src/lib/ai/conversation/state");

  let passed = 0, failed = 0;
  const assert = (c: boolean, m: string) => {
    if (c) { passed++; console.log(`  ✅ ${m}`); } else { failed++; console.error(`  ❌ FAILED: ${m}`); }
  };

  const student = await prisma.user.findFirst({ where: { role: "STUDENT" } });
  const lesson = await prisma.lesson.findFirst();
  if (!student || !lesson) throw new Error("Seed a student and a lesson first.");
  // Ensure no teacher-disabled flag blocks the tutor
  console.log(`Student ${student.email}, lesson "${lesson.title}"`);

  // The tutor needs a PUBLISHED, unlocked lesson only for grounding; conversation state works regardless.
  const lessonId = lesson.id;
  const ask = async (text: string) => {
    AITutorService.resetRateLimit();
    return AITutorService.interact({ studentId: student.id, lessonId, studentQuery: text });
  };

  const texts = ["I don't understand", "i still dont get it", "still confused", "I really dont understand this", "idk what to do", "I'm lost", "ok", "hi"];
  const replies = [];
  for (const t of texts) replies.push(await ask(t));
  assert(new Set(replies.map((r) => r.conversationId)).size === 1, "One conversation across 8 turns (reuse works on PostgreSQL)");
  const convId = replies[0].conversationId;

  const row = await prisma.aITutorConversation.findUnique({ where: { id: convId } });
  assert(!!row?.stateJson, "stateJson persisted to PostgreSQL");
  const st = parseState(row!.stateJson);
  assert(st.turn === 8 && st.strategyHistory.length === 8, `State has all 8 turns (turn=${st.turn})`);
  assert(st.needsTeacherAttention === true, "Teacher-attention flag persisted");

  const msgs = await prisma.aITutorMessage.count({ where: { conversationId: convId } });
  assert(msgs === 16, `16 messages stored (${msgs})`);
  const recent = await dbService.getAITutorMessages(convId, 6);
  assert(recent.length === 6, "getAITutorMessages returns 6");
  const lastStored = await prisma.aITutorMessage.findFirst({ where: { conversationId: convId }, orderBy: { createdAt: "desc" } });
  assert(recent[recent.length - 1].id === lastStored!.id, "REGRESSION FIX: the 'recent' window is the LATEST messages (was the oldest on PostgreSQL)");
  assert(new Date(recent[0].createdAt) <= new Date(recent[recent.length - 1].createdAt), "...in chronological order");

  const distinct = new Set(replies.map((r) => `${r.message.content} ${r.message.guidingQuestion}`));
  assert(distinct.size >= 7, `At least 7 distinct tutor messages out of 8 (${distinct.size})`);

  const flags = await dbService.getTutorAttentionFlags(student.id);
  assert(flags.length >= 1 && flags[0].conversationId === convId, "Attention flags found through the PostgreSQL query");

  const other = await prisma.user.findFirst({ where: { role: "STUDENT", id: { not: student.id } } });
  if (other) {
    const stolen = await dbService.saveAITutorConversationState(convId, other.id, "{}");
    assert(stolen === false, "Another student cannot overwrite this conversation's state");
    const view = await dbService.getAITutorConversation(convId, other.id);
    assert(view === null, "Another student cannot read this conversation");
  }

  // Idle expiry: age the conversation, next turn starts a fresh one
  await prisma.$executeRaw`UPDATE "AITutorConversation" SET "updatedAt" = NOW() - INTERVAL '4 hours' WHERE id = ${convId}`;
  const fresh = await ask("hi");
  assert(fresh.conversationId !== convId, "After 4 idle hours a new conversation starts on PostgreSQL");
  assert(parseState((await prisma.aITutorConversation.findUnique({ where: { id: fresh.conversationId } }))!.stateJson).turn === 1, "...with fresh state");

  await prisma.aITutorConversation.deleteMany({ where: { studentId: student.id, lessonId } });
  console.log(`\nPOSTGRES PHASE 23 RESULTS: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error("Crashed:", e); process.exit(1); });

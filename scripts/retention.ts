/**
 * Data retention (Phase 43). Deletes what the privacy notice says is not kept forever:
 *   - tutor conversations (and their messages) not touched for RETENTION_TUTOR_DAYS (default 365): free text a student wrote
 *   - internet addresses in the security log older than RETENTION_AUDIT_IP_DAYS (default 90): the log entry stays, the address is cleared
 * and REPORTS (never deletes) disabled accounts older than RETENTION_DISABLED_ACCOUNT_DAYS (default 365), for an administrator to decide.
 *
 *   npx tsx scripts/retention.ts            dry run: says what it would do
 *   npx tsx scripts/retention.ts --apply    does it
 * Schedule it (cron / the host's scheduler) weekly. Needs DATABASE_URL.
 */
import { PrismaClient } from "@prisma/client";

export interface RetentionOptions { apply: boolean; now?: Date; tutorDays?: number; auditIpDays?: number; disabledDays?: number }
export interface RetentionResult { apply: boolean; tutorConversations: number; tutorMessages: number; auditAddresses: number; disabledAccounts: Array<{ id: string; disabledAt: Date }> }

const days = (envName: string, fallback: number) => { const n = Number(process.env[envName]); return Number.isFinite(n) && n > 0 ? n : fallback; };

export async function runRetention(db: PrismaClient, o: RetentionOptions): Promise<RetentionResult> {
  const now = o.now ?? new Date();
  const ago = (d: number) => new Date(now.getTime() - d * 86400000);
  const tutorBefore = ago(o.tutorDays ?? days("RETENTION_TUTOR_DAYS", 365));
  const ipBefore = ago(o.auditIpDays ?? days("RETENTION_AUDIT_IP_DAYS", 90));
  const disabledBefore = ago(o.disabledDays ?? days("RETENTION_DISABLED_ACCOUNT_DAYS", 365));

  const oldConvs = await db.aITutorConversation.findMany({ where: { updatedAt: { lt: tutorBefore } }, select: { id: true } });
  const ids = oldConvs.map((c) => c.id);
  const tutorMessages = ids.length ? await db.aITutorMessage.count({ where: { conversationId: { in: ids } } }) : 0;
  const auditAddresses = await db.auditLog.count({ where: { createdAt: { lt: ipBefore }, ip: { not: null } } });
  const disabled = await db.user.findMany({ where: { disabledAt: { lt: disabledBefore } }, select: { id: true, disabledAt: true } });

  if (o.apply) {
    if (ids.length) await db.aITutorConversation.deleteMany({ where: { id: { in: ids } } }); // messages go with them
    if (auditAddresses) await db.auditLog.updateMany({ where: { createdAt: { lt: ipBefore }, ip: { not: null } }, data: { ip: null } });
  }
  return { apply: o.apply, tutorConversations: ids.length, tutorMessages, auditAddresses, disabledAccounts: disabled.map((d) => ({ id: d.id, disabledAt: d.disabledAt! })) };
}

if (process.argv[1] && /retention\.(ts|js)$/.test(process.argv[1])) {
  (async () => {
    if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? "")) { console.error("retention: DATABASE_URL must be a PostgreSQL URL."); process.exit(1); }
    const db = new PrismaClient();
    try {
      const apply = process.argv.includes("--apply");
      const r = await runRetention(db, { apply });
      console.log(`${apply ? "DELETED" : "WOULD DELETE (dry run; add --apply)"}: ${r.tutorConversations} tutor conversation(s) with ${r.tutorMessages} message(s); ${apply ? "cleared" : "would clear"} ${r.auditAddresses} address(es) in the security log.`);
      if (r.disabledAccounts.length) console.log(`Disabled for over a year (decide whether to erase them from the Admin page): ${r.disabledAccounts.map((a) => a.id).join(", ")}`);
    } finally { await db.$disconnect(); }
  })().catch((e) => { console.error("retention failed:", e); process.exit(1); });
}

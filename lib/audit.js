import { count, desc, eq } from "drizzle-orm";
import { auditLog, members } from "../db/schema.js";

// Records one admin change. Best-effort: a logging failure is reported to the
// server log but never undoes or blocks the change it describes.
export async function audit(db, { actor, action, table = null, id = null, summary, details = null, now = new Date().toISOString() }) {
  try {
    await db.insert(auditLog).values({
      actorId: actor ?? "unknown",
      action,
      targetTable: table,
      targetId: id == null ? null : Number(id),
      summary,
      details: details ? JSON.stringify(details) : null,
      createdAt: now,
    });
  } catch (e) {
    console.error("Audit log write failed", action, e?.message);
  }
}

// The fields that differ between two versions of a record: { field: [before, after] }.
export function changedFields(before, after, fields) {
  const out = {};
  for (const f of fields) {
    const a = before?.[f] ?? null;
    const b = after?.[f] ?? null;
    if (a !== b) out[f] = [a, b];
  }
  return out;
}

// Newest first, with the admin's name when their account is linked to a member.
export async function listAudit(db, { limit = 100, offset = 0 } = {}) {
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        actorId: auditLog.actorId,
        actorName: members.name,
        action: auditLog.action,
        targetTable: auditLog.targetTable,
        targetId: auditLog.targetId,
        summary: auditLog.summary,
        details: auditLog.details,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(members, eq(members.clerkUserId, auditLog.actorId))
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(auditLog),
  ]);
  return { rows: rows.map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null })), total };
}

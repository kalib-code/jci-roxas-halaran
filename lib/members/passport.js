import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { passportEntries, members, officerTerms, events } from "../../db/schema.js";

export const DEFAULT_POINTS = { training: 2, project_led: 5, project_joined: 1, award: 5, position: 3 };
export const KIND_LABELS = {
  training: "Training",
  project_led: "Project led",
  project_joined: "Project joined",
  award: "Award",
  position: "Position",
};

export const entryInput = z.object({
  kind: z.enum(["training", "project_led", "project_joined", "award", "position"], { errorMap: () => ({ message: "Choose a kind" }) }),
  title: z.string().trim().min(2, "Describe the entry").max(160),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date"),
  note: z.string().trim().max(500).default(""),
});

const issues = (r) => r.error.issues.map((i) => i.message);

async function insertEntry(db, memberId, raw, { status, userId, now, points }) {
  const parsed = entryInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const [entry] = await db
    .insert(passportEntries)
    .values({
      memberId: Number(memberId),
      kind: d.kind,
      title: d.title,
      date: d.date,
      points: Number.isInteger(points) ? points : DEFAULT_POINTS[d.kind],
      note: d.note || null,
      status,
      requestedBy: status === "requested" ? userId : null,
      verifiedBy: status === "verified" ? userId : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return { ok: true, entry };
}

export function requestEntry(db, memberId, raw, { userId, now = new Date().toISOString() }) {
  return insertEntry(db, memberId, raw, { status: "requested", userId, now });
}

export function addVerifiedEntry(db, memberId, raw, { userId, now = new Date().toISOString(), points } = {}) {
  return insertEntry(db, memberId, raw, { status: "verified", userId, now, points });
}

async function review(db, id, status, { userId, now, points }) {
  const [current] = await db.select().from(passportEntries).where(eq(passportEntries.id, Number(id)));
  if (!current) return { ok: false, errors: ["Entry not found"] };
  if (current.status !== "requested") return { ok: false, errors: ["This entry was already reviewed"] };
  const values = { status, verifiedBy: userId, updatedAt: now };
  if (status === "verified" && Number.isInteger(points) && points >= 0) values.points = points;
  const [entry] = await db.update(passportEntries).set(values).where(eq(passportEntries.id, current.id)).returning();
  return { ok: true, entry };
}

export function verifyEntry(db, id, { userId, now = new Date().toISOString(), points } = {}) {
  return review(db, id, "verified", { userId, now, points });
}

export function declineEntry(db, id, { userId, now = new Date().toISOString() } = {}) {
  return review(db, id, "declined", { userId, now });
}

export function listRequestedEntries(db) {
  return db
    .select({
      id: passportEntries.id,
      kind: passportEntries.kind,
      title: passportEntries.title,
      date: passportEntries.date,
      points: passportEntries.points,
      note: passportEntries.note,
      memberId: passportEntries.memberId,
      memberName: members.name,
    })
    .from(passportEntries)
    .innerJoin(members, eq(passportEntries.memberId, members.id))
    .where(eq(passportEntries.status, "requested"))
    .orderBy(asc(passportEntries.createdAt), asc(passportEntries.id));
}

export function computeBadges(entries, positionCount) {
  const n = (kind) => entries.filter((e) => e.kind === kind).length;
  const badges = [];
  if (n("project_joined") + n("training") > 0) badges.push({ key: "first-steps", label: "First steps" });
  if (n("training") > 0) badges.push({ key: "trained", label: `Trained ×${n("training")}` });
  if (n("project_led") > 0) badges.push({ key: "chair", label: `Project chair ×${n("project_led")}` });
  if (positionCount > 0) badges.push({ key: "officer", label: "Officer" });
  if (n("award") > 0) badges.push({ key: "awardee", label: "Awardee" });
  if (n("training") >= 10) badges.push({ key: "ten-trainings", label: "Ten trainings" });
  return badges;
}

export async function getPassport(db, memberId) {
  const id = Number(memberId);
  const [all, positions] = await Promise.all([
    db.select().from(passportEntries).where(eq(passportEntries.memberId, id)).orderBy(desc(passportEntries.date), desc(passportEntries.id)),
    db.select({ role: officerTerms.role, year: officerTerms.year }).from(officerTerms).where(eq(officerTerms.memberId, id)).orderBy(desc(officerTerms.year)),
  ]);
  const entries = all.filter((e) => e.status === "verified");
  const pending = all.filter((e) => e.status === "requested");
  const points = entries.reduce((s, e) => s + e.points, 0) + DEFAULT_POINTS.position * positions.length;
  return { entries, pending, positions, points, badges: computeBadges(entries, positions.length) };
}

// Attendance at an event that belongs to a project becomes a verified
// "project joined" entry for the member with the RSVP's email.
export async function syncAttendanceEntry(db, rsvp, attended, { now = new Date().toISOString() } = {}) {
  if (!attended) {
    await db.delete(passportEntries).where(and(eq(passportEntries.refTable, "rsvps"), eq(passportEntries.refId, rsvp.id)));
    return { ok: true, added: false };
  }
  const [event] = await db.select().from(events).where(eq(events.id, rsvp.eventId));
  if (!event?.projectId) return { ok: true, added: false };
  const [member] = await db
    .select()
    .from(members)
    .where(sql`lower(${members.email}) = ${rsvp.email.toLowerCase()}`)
    .orderBy(asc(members.id));
  if (!member) return { ok: true, added: false };
  await db
    .insert(passportEntries)
    .values({
      memberId: member.id,
      kind: "project_joined",
      title: event.title,
      date: event.startAt.slice(0, 10),
      points: DEFAULT_POINTS.project_joined,
      refTable: "rsvps",
      refId: rsvp.id,
      status: "verified",
      verifiedBy: "system",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  return { ok: true, added: true };
}

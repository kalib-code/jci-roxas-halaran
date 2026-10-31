import { randomBytes } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { attendance, events, members, officerTerms, rsvps } from "../../db/schema.js";
import { SITE } from "../site.js";
import { logEvent } from "../evidence.js";
import { isUniqueViolation } from "../db-errors.js";
import { syncAttendanceEntry, syncCheckinEntry } from "../members/passport.js";

export const HOME_LO = SITE.name;
export const GUEST_LO = "Non-JCI guest";
const issues = (r) => r.error.issues.map((i) => i.message);
const DAY_MS = 24 * 60 * 60 * 1000;

const attendeeShape = {
  name: z.string().trim().min(2, "Enter your full name").max(120),
  position: z.string().trim().min(2, "Enter your position, e.g. Member or Guest").max(80),
  affiliation: z.enum(["home", "other_lo", "guest"], { errorMap: () => ({ message: "Choose your Local Organization" }) }),
  localOrganization: z.string().trim().max(120).default(""),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").or(z.literal("")).default(""),
};

// The sheet's Local Organization column: our chapter, theirs, or what a guest typed.
const withOrganization = (schema) =>
  schema
    .refine((d) => d.affiliation !== "other_lo" || d.localOrganization.length >= 2, { message: "Enter your chapter, e.g. JCI Capiz" })
    .transform((d) => ({ ...d, localOrganization: d.affiliation === "home" ? HOME_LO : d.localOrganization || GUEST_LO }));

export const attendeeInput = withOrganization(z.object(attendeeShape));
export const checkinInput = withOrganization(
  z.object({
    ...attendeeShape,
    code: z.string().trim().min(6).max(40),
    consent: z.literal(true, { errorMap: () => ({ message: "Please agree to the privacy notice" }) }),
  }),
);

export const newCheckinCode = () => randomBytes(9).toString("base64url");
const nameKey = (name) => name.toLowerCase().replace(/\s+/g, " ").trim();

// Check-in shuts a day after the event even if nobody closes it, so a QR photo
// posted online can't keep collecting entries.
export function checkinIsOpen(event, now = new Date()) {
  if (!event?.checkinOpen || !event.checkinCode) return false;
  const last = new Date(`${event.endAt || event.startAt}:00+08:00`).getTime();
  return now.getTime() <= last + DAY_MS;
}

export async function getCheckinEvent(db, code) {
  if (!code) return null;
  const [event] = await db.select().from(events).where(eq(events.checkinCode, String(code)));
  return event ?? null;
}

export async function setCheckin(db, eventId, { open, newCode = false }) {
  const [event] = await db.select().from(events).where(eq(events.id, Number(eventId)));
  if (!event) return { ok: false, errors: ["Event not found"] };
  const values = { checkinOpen: Boolean(open) };
  if (newCode || (open && !event.checkinCode)) values.checkinCode = newCheckinCode();
  const [updated] = await db.update(events).set(values).where(eq(events.id, event.id)).returning();
  return { ok: true, event: updated };
}

export function listAttendance(db, eventId) {
  return db.select().from(attendance).where(eq(attendance.eventId, Number(eventId))).orderBy(asc(attendance.checkedInAt), asc(attendance.id));
}

async function memberByEmail(db, email) {
  if (!email) return null;
  const [member] = await db.select().from(members).where(sql`lower(${members.email}) = ${email}`).orderBy(asc(members.id));
  return member ?? null;
}

async function rsvpByEmail(db, eventId, email) {
  if (!email) return null;
  const [rsvp] = await db.select().from(rsvps).where(and(eq(rsvps.eventId, eventId), eq(rsvps.email, email)));
  return rsvp ?? null;
}

const findExisting = (rows, d, rsvpId = null) =>
  rows.find((r) => (rsvpId && r.rsvpId === rsvpId) || (d.email && r.email === d.email) || nameKey(r.name) === nameKey(d.name));

// Adds a participant once. A matching RSVP is marked attended and carries the
// passport credit; otherwise the check-in itself does.
async function record(db, event, d, { source, addedBy = null, now }) {
  const rows = await listAttendance(db, event.id);
  const existing = findExisting(rows, d);
  if (existing) return { ok: true, already: true, attendee: existing };
  const [member, rsvp] = await Promise.all([memberByEmail(db, d.email), rsvpByEmail(db, event.id, d.email)]);
  let row;
  try {
    [row] = await db
      .insert(attendance)
      .values({
        eventId: event.id,
        name: d.name,
        position: d.position,
        affiliation: d.affiliation,
        localOrganization: d.localOrganization,
        email: d.email || null,
        memberId: member?.id ?? null,
        rsvpId: rsvp?.id ?? null,
        source,
        checkedInAt: now,
        addedBy,
      })
      .returning();
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: true, already: true, attendee: findExisting(await listAttendance(db, event.id), d) };
    throw e;
  }
  if (rsvp) {
    const [marked] = await db.update(rsvps).set({ attended: true }).where(eq(rsvps.id, rsvp.id)).returning();
    await syncAttendanceEntry(db, marked, true, { now });
  } else {
    await syncCheckinEntry(db, row, true, { now });
  }
  await logEvent(db, { type: "attendance_marked", actor: addedBy ?? "public", refTable: "attendance", refId: row.id, now });
  return { ok: true, attendee: row };
}

export async function checkIn(db, raw, { now = new Date() } = {}) {
  const parsed = checkinInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const event = await getCheckinEvent(db, parsed.data.code);
  if (!checkinIsOpen(event, now)) return { ok: false, errors: ["Check-in for this event is closed"] };
  const r = await record(db, event, parsed.data, { source: "qr", now: now.toISOString() });
  return { ...r, event };
}

export async function addAttendee(db, eventId, raw, { userId, now = new Date().toISOString() }) {
  const parsed = attendeeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const [event] = await db.select().from(events).where(eq(events.id, Number(eventId)));
  if (!event) return { ok: false, errors: ["Event not found"] };
  const r = await record(db, event, parsed.data, { source: "admin", addedBy: userId, now });
  return r.already ? { ok: false, errors: [`${r.attendee?.name ?? "They"} are already on this sheet`] } : r;
}

export async function updateAttendee(db, id, raw, { now = new Date().toISOString() } = {}) {
  const parsed = attendeeInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const [current] = await db.select().from(attendance).where(eq(attendance.id, Number(id)));
  if (!current) return { ok: false, errors: ["Participant not found"] };
  const member = await memberByEmail(db, d.email);
  try {
    const [row] = await db
      .update(attendance)
      .set({ name: d.name, position: d.position, affiliation: d.affiliation, localOrganization: d.localOrganization, email: d.email || null, memberId: member?.id ?? null })
      .where(eq(attendance.id, current.id))
      .returning();
    // A new email can name a different member: move the passport credit with it.
    if (!row.rsvpId && row.memberId !== current.memberId) {
      await syncCheckinEntry(db, row, false);
      await syncCheckinEntry(db, row, true, { now });
    }
    return { ok: true, attendee: row, before: current };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: ["Someone with that email is already on this sheet"] };
    throw e;
  }
}

export async function removeAttendee(db, id) {
  const [row] = await db.delete(attendance).where(eq(attendance.id, Number(id))).returning();
  if (!row) return { ok: false, errors: ["Participant not found"] };
  if (row.rsvpId) {
    const [rsvp] = await db.update(rsvps).set({ attended: false }).where(eq(rsvps.id, row.rsvpId)).returning();
    if (rsvp) await syncAttendanceEntry(db, rsvp, false);
  } else {
    await syncCheckinEntry(db, row, false);
  }
  return { ok: true, attendee: row };
}

// What we can tell about an RSVP from our records; anything we can't, an admin fills in.
async function detailsForRsvp(db, rsvp, event) {
  const member = await memberByEmail(db, rsvp.email);
  if (!member) return { member, position: "Guest", affiliation: "guest", localOrganization: GUEST_LO };
  const [term] = await db
    .select({ role: officerTerms.role })
    .from(officerTerms)
    .where(and(eq(officerTerms.memberId, member.id), eq(officerTerms.year, Number(event.startAt.slice(0, 4)))))
    .orderBy(asc(officerTerms.sort));
  return { member, position: term?.role ?? "Member", affiliation: "home", localOrganization: HOME_LO };
}

// Ticking "attended" on an RSVP puts them on the sheet; unticking takes them off.
// The RSVP itself already carries the passport credit and the evidence log entry.
export async function syncRsvpAttendance(db, rsvp, attended, { userId = null, now = new Date().toISOString() } = {}) {
  if (!attended) {
    await db.delete(attendance).where(eq(attendance.rsvpId, rsvp.id));
    return { ok: true };
  }
  const [event] = await db.select().from(events).where(eq(events.id, rsvp.eventId));
  if (!event) return { ok: false, errors: ["Event not found"] };
  const existing = findExisting(await listAttendance(db, event.id), { name: rsvp.name, email: rsvp.email }, rsvp.id);
  if (existing) {
    if (!existing.rsvpId) {
      // They scanned in first: link the RSVP, which now holds the passport credit.
      await db.update(attendance).set({ rsvpId: rsvp.id }).where(eq(attendance.id, existing.id));
      await syncCheckinEntry(db, existing, false);
    }
    return { ok: true, attendee: existing };
  }
  const { member, ...details } = await detailsForRsvp(db, rsvp, event);
  const [row] = await db
    .insert(attendance)
    .values({ eventId: event.id, name: rsvp.name, ...details, email: rsvp.email, memberId: member?.id ?? null, rsvpId: rsvp.id, source: "rsvp", checkedInAt: now, addedBy: userId })
    .onConflictDoNothing()
    .returning();
  return { ok: true, attendee: row ?? null };
}

// The board that certifies a sheet: the event year's officers, or the latest on record.
export async function sheetCertifiers(db, event) {
  const rows = await db
    .select({ name: members.name, role: officerTerms.role, year: officerTerms.year })
    .from(officerTerms)
    .innerJoin(members, eq(officerTerms.memberId, members.id))
    .where(sql`${officerTerms.role} in ('President', 'Secretary')`);
  const year = Number(event.startAt.slice(0, 4));
  const years = [...new Set(rows.map((r) => r.year))];
  const use = years.includes(year) ? year : Math.max(...years, -Infinity);
  const pick = (role) => rows.find((r) => r.year === use && r.role === role)?.name ?? null;
  return { president: pick("President"), secretary: pick("Secretary"), chairperson: event.chairperson || null };
}

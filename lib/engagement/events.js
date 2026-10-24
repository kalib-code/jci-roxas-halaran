import { and, asc, count, desc, eq, ne } from "drizzle-orm";
import { events, projects, rsvps, volunteerSignups } from "../../db/schema.js";
import { eventInput, rsvpInput, volunteerInput } from "./validation.js";
import { cleanHtml } from "../sanitize.js";
import { phNow, slugify } from "../format.js";
import { logEvent } from "../evidence.js";
import { isUniqueViolation } from "../db-errors.js";

const issues = (r) => r.error.issues.map((i) => i.message);

async function rsvpCounts(db, eventId) {
  const rows = await db
    .select({ status: rsvps.status, n: count() })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId))
    .groupBy(rsvps.status);
  const of = (s) => rows.find((r) => r.status === s)?.n ?? 0;
  return { going: of("going"), waitlist: of("waitlist") };
}

export async function getEvent(db, id) {
  const [row] = await db.select().from(events).where(eq(events.id, Number(id)));
  return row ?? null;
}

export async function getEventBySlug(db, slug) {
  const [row] = await db.select().from(events).where(eq(events.slug, slug));
  return row ? { ...row, ...(await rsvpCounts(db, row.id)) } : null;
}

export async function listEvents(db, { now = new Date() } = {}) {
  const today = phNow(now);
  const all = await db.select().from(events).orderBy(asc(events.startAt), asc(events.id));
  const withCounts = await Promise.all(all.map(async (e) => ({ ...e, ...(await rsvpCounts(db, e.id)) })));
  const isUpcoming = (e) => (e.endAt || e.startAt) >= today;
  return { upcoming: withCounts.filter(isUpcoming), past: withCounts.filter((e) => !isUpcoming(e)).reverse() };
}

export async function saveEvent(db, { id, expectedUpdatedAt, ...raw }, { now = new Date().toISOString() } = {}) {
  const parsed = eventInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const existing = id ? await getEvent(db, id) : null;
  if (id && !existing) return { ok: false, errors: ["Event not found"] };
  if (existing && expectedUpdatedAt !== existing.updatedAt) {
    return { ok: false, errors: ["This was changed since you opened it — reload"] };
  }
  const slug = existing ? existing.slug : slugify(d.slug || d.title);
  if (!existing) {
    const taken = await db.select({ id: events.id }).from(events).where(eq(events.slug, slug));
    if (taken.length) return { ok: false, errors: [`The address /events/${slug} is taken — try ${slug}-2`] };
  }
  if (d.coverUrl && !d.coverAlt) return { ok: false, errors: ["Add alt text for the cover image"] };
  const values = {
    title: d.title,
    slug,
    description: cleanHtml(d.descriptionHtml),
    descriptionJson: d.descriptionJson || null,
    startAt: d.startAt,
    endAt: d.endAt || null,
    venue: d.venue || null,
    capacity: d.capacity,
    rsvpOpen: d.rsvpOpen,
    projectId: d.projectId,
    coverUrl: d.coverUrl || null,
    coverAlt: d.coverAlt || null,
    updatedAt: now,
  };
  const [event] = existing
    ? await db.update(events).set(values).where(eq(events.id, existing.id)).returning()
    : await db.insert(events).values(values).returning();
  return { ok: true, event };
}

export async function submitRsvp(db, raw, { now = new Date().toISOString() } = {}) {
  const parsed = rsvpInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const event = await getEvent(db, d.eventId);
  if (!event) return { ok: false, errors: ["Event not found"] };
  if (!event.rsvpOpen) return { ok: false, errors: ["RSVPs are closed for this event"] };
  const { going } = await rsvpCounts(db, event.id);
  const status = event.capacity && going >= event.capacity ? "waitlist" : "going";
  try {
    const [rsvp] = await db
      .insert(rsvps)
      .values({ eventId: event.id, name: d.name, email: d.email, phone: d.phone || null, consent: true, status, createdAt: now })
      .returning();
    await logEvent(db, { type: "rsvp_created", refTable: "rsvps", refId: rsvp.id, meta: { status }, now });
    return { ok: true, rsvp, status, event };
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, errors: ["You're already on the list for this event"] };
    throw e;
  }
}

export function listRsvps(db, eventId) {
  return db.select().from(rsvps).where(eq(rsvps.eventId, Number(eventId))).orderBy(asc(rsvps.createdAt), asc(rsvps.id));
}

export async function setAttendance(db, rsvpId, attended, { userId, now = new Date().toISOString() }) {
  const [rsvp] = await db.update(rsvps).set({ attended }).where(eq(rsvps.id, Number(rsvpId))).returning();
  if (!rsvp) return { ok: false, errors: ["RSVP not found"] };
  if (attended) await logEvent(db, { type: "attendance_marked", actor: userId, refTable: "rsvps", refId: rsvp.id, now });
  return { ok: true, rsvp };
}

export async function moveToGoing(db, rsvpId) {
  const [rsvp] = await db
    .update(rsvps)
    .set({ status: "going" })
    .where(and(eq(rsvps.id, Number(rsvpId)), ne(rsvps.status, "going")))
    .returning();
  return rsvp ? { ok: true, rsvp } : { ok: false, errors: ["Already going"] };
}

export async function submitVolunteer(db, raw, { now = new Date().toISOString() } = {}) {
  const parsed = volunteerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  const d = parsed.data;
  const [signup] = await db
    .insert(volunteerSignups)
    .values({ projectId: d.projectId, eventId: d.eventId, name: d.name, email: d.email, phone: d.phone || null, skills: d.skills || null, consent: true, createdAt: now })
    .returning();
  await logEvent(db, { type: "volunteer_signed_up", refTable: "volunteer_signups", refId: signup.id, now });
  return { ok: true, signup };
}

// Every volunteer signup, newest first, with the project or event they picked.
export function listVolunteers(db) {
  return db
    .select({
      id: volunteerSignups.id,
      name: volunteerSignups.name,
      email: volunteerSignups.email,
      phone: volunteerSignups.phone,
      skills: volunteerSignups.skills,
      createdAt: volunteerSignups.createdAt,
      projectTitle: projects.title,
      projectSlug: projects.slug,
      eventTitle: events.title,
      eventId: events.id,
    })
    .from(volunteerSignups)
    .leftJoin(projects, eq(volunteerSignups.projectId, projects.id))
    .leftJoin(events, eq(volunteerSignups.eventId, events.id))
    .orderBy(desc(volunteerSignups.createdAt), desc(volunteerSignups.id));
}

export function listRsvpsForEmail(db, email) {
  return db
    .select({
      id: rsvps.id,
      status: rsvps.status,
      attended: rsvps.attended,
      title: events.title,
      slug: events.slug,
      startAt: events.startAt,
      venue: events.venue,
    })
    .from(rsvps)
    .innerJoin(events, eq(rsvps.eventId, events.id))
    .where(eq(rsvps.email, (email ?? "").trim().toLowerCase()))
    .orderBy(asc(events.startAt));
}

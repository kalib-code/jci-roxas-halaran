import { randomBytes, randomInt } from "node:crypto";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { attendance, events, members, officerTerms, rsvps } from "../../db/schema.js";
import { SITE } from "../site.js";
import { logEvent } from "../evidence.js";
import { isUniqueViolation } from "../db-errors.js";
import { syncAttendanceEntry, syncCheckinEntry } from "../members/passport.js";
import { inPhilippines, LOCATION_MESSAGE, nearbyCheck, nearbyMessage } from "../proof/location.js";

export const HOME_LO = SITE.name;
export const GUEST_LO = "Non-JCI guest";
const issues = (r) => r.error.issues.map((i) => i.message);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Names and positions end up in emails sent from the chapter's address, so they
// can't carry links: names are letters and name punctuation only.
// Any "word.word" (two or more characters after the dot) reads as a web address,
// whatever its ending; initials like "U.P." or "Jr." keep one letter per dot.
const LINKISH = /(https?:|:\/\/|www[.。．｡]|@|＠|[\p{L}\p{N}-][.。．｡][\p{L}\p{N}]{2,})/iu;
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .,'’-]*$/u;

const attendeeShape = {
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(80)
    .regex(NAME, "Use letters only in your name")
    .refine((v) => !LINKISH.test(v), "Names can't contain links"),
  position: z
    .string()
    .trim()
    .min(2, "Enter your position, e.g. Member or Guest")
    .max(60)
    .refine((v) => !LINKISH.test(v), "Positions can't contain links"),
  affiliation: z.enum(["home", "other_lo", "guest"], { errorMap: () => ({ message: "Choose your Local Organization" }) }),
  localOrganization: z.string().trim().max(120).default("").refine((v) => !LINKISH.test(v), "Organizations can't contain links"),
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
    // The start code from the meeting, on the online link.
    spokenCode: z.string().max(20).default(""),
    consent: z.literal(true, { errorMap: () => ({ message: "Please agree to the privacy notice" }) }),
    // The phone's reading, sent only when the event checks people are at the venue.
    location: z
      .object({
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
        accuracy: z.number().finite().nonnegative(),
      })
      .nullish(),
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

// Online and hybrid events take check-ins from the meeting; hybrid ones from the room too.
export const hasOnline = (event) => event?.format === "online" || event?.format === "hybrid";
export const hasRoom = (event) => event?.format !== "online";

// What the host reads out in the meeting: six digits, easy to say and to type on a phone.
export const newSpokenCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const spoken = (v) => String(v ?? "").replace(/\D/g, "");

// Whether a link opens the online form, which needs the codes. An online-only
// event has no room, so even its old QR link asks for them.
export function isOnlineLink(event, code) {
  if (!event) return false;
  return event.format === "online" || (event.format === "hybrid" && code === event.onlineCode);
}

// The event a check-in link belongs to. A leftover online link stops working once
// the event is in person only, rather than turning into a code-free room check-in.
export async function getCheckinEvent(db, code) {
  if (!code) return null;
  const c = String(code);
  const [event] = await db.select().from(events).where(or(eq(events.checkinCode, c), eq(events.onlineCode, c)));
  if (!event) return null;
  if (event.checkinCode !== c && !hasOnline(event)) return null;
  return event;
}

export async function setCheckin(db, eventId, { open, newCode = false, newOnlineCode = false }) {
  const [event] = await db.select().from(events).where(eq(events.id, Number(eventId)));
  if (!event) return { ok: false, errors: ["Event not found"] };
  const values = { checkinOpen: Boolean(open) };
  if (newCode || (open && !event.checkinCode)) values.checkinCode = newCheckinCode();
  if (hasOnline(event)) {
    if (newOnlineCode || (open && !event.onlineCode)) values.onlineCode = newCheckinCode();
    const start = event.startCode ?? (open ? newSpokenCode() : null);
    if (start !== event.startCode) values.startCode = start;
    if (open && !event.endCode) {
      do values.endCode = newSpokenCode();
      while (values.endCode === start);
    }
  }
  const [updated] = await db.update(events).set(values).where(eq(events.id, event.id)).returning();
  return { ok: true, event: updated };
}

// How long the end code keeps working after the organizer shows it: long enough
// for a closing program to wrap up and stragglers to type it in, short enough
// that a friend can't text it to someone the next morning.
// Showing it again restarts the clock.
export const END_CODE_WINDOW_MS = HOUR_MS;

export function endCodeOpen(event, now = new Date()) {
  if (!event?.endCodeShownAt || !checkinIsOpen(event, now)) return false;
  return now.getTime() <= new Date(event.endCodeShownAt).getTime() + END_CODE_WINDOW_MS;
}

// The organizer shows the end code near the close; until then nobody can enter it.
export async function showEndCode(db, eventId, { now = new Date() } = {}) {
  const [event] = await db.select().from(events).where(eq(events.id, Number(eventId)));
  if (!event) return { ok: false, errors: ["Event not found"] };
  if (!hasOnline(event)) return { ok: false, errors: ["This event has no online check-in"] };
  if (!checkinIsOpen(event, now) || !event.endCode) return { ok: false, errors: ["Open check-in first"] };
  const [updated] = await db.update(events).set({ endCodeShownAt: now.toISOString() }).where(eq(events.id, event.id)).returning();
  return { ok: true, event: updated };
}

// Online attendees count once they've entered the end code (or an organizer
// counted them); everyone else counts from the moment they're on the sheet.
export const attendedFully = (row) => row.source !== "online" || Boolean(row.checkedOutAt);

// The venue check: on only with a pin to measure from.
export const checksNearby = (event) => Boolean(event?.checkinNearby && event.lat != null && event.lng != null);

export async function setCheckinNearby(db, eventId, { nearby, lat = null, lng = null }) {
  const [event] = await db.select().from(events).where(eq(events.id, Number(eventId)));
  if (!event) return { ok: false, errors: ["Event not found"] };
  const pin = lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : { lat: event.lat, lng: event.lng };
  if (pin.lat != null && !inPhilippines(pin.lat, pin.lng)) return { ok: false, errors: [LOCATION_MESSAGE] };
  if (nearby && pin.lat == null) return { ok: false, errors: ["Pin the venue on the map first."] };
  const [updated] = await db.update(events).set({ ...pin, checkinNearby: Boolean(nearby) }).where(eq(events.id, event.id)).returning();
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

// Email (or the RSVP) identifies someone. Names only catch a repeat scan at the
// door; organizers can still add a second person who shares a name.
const findExisting = (rows, d, { rsvpId = null, byName = false } = {}) =>
  rows.find((r) => (rsvpId && r.rsvpId === rsvpId) || (d.email && r.email === d.email) || (byName && nameKey(r.name) === nameKey(d.name)));

// A matching RSVP is marked attended and carries the passport credit; otherwise
// the check-in itself does.
async function credit(db, row, { actor = null, now }) {
  if (row.rsvpId) {
    const [marked] = await db.update(rsvps).set({ attended: true }).where(eq(rsvps.id, row.rsvpId)).returning();
    if (marked) await syncAttendanceEntry(db, marked, true, { now });
  } else {
    await syncCheckinEntry(db, row, true, { now });
  }
  await logEvent(db, { type: "attendance_marked", actor: actor ?? "public", refTable: "attendance", refId: row.id, now });
}

// Adds a participant once. Online attendees get their credit later, at the end code.
async function record(db, event, d, { source, addedBy = null, distanceM = null, now }) {
  const rows = await listAttendance(db, event.id);
  const existing = findExisting(rows, d, { byName: source === "qr" });
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
        distanceM,
      })
      .returning();
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: true, already: true, attendee: findExisting(await listAttendance(db, event.id), d, { byName: source === "qr" }) };
    throw e;
  }
  if (attendedFully(row)) await credit(db, row, { actor: addedBy, now });
  return { ok: true, attendee: row };
}

// At an event another organization chairs, we record only our own members.
const ourMembersOnly = (event, raw) => (event && !event.weChair ? { ...raw, affiliation: "home", localOrganization: "" } : raw);

const CLOSED = { ok: false, errors: ["Check-in for this event is closed"] };
const wrongCode = (which) => ({ ok: false, errors: [`That isn't the ${which} code — check what the host said or showed`] });

export async function checkIn(db, raw, { now = new Date() } = {}) {
  const code = String(raw?.code ?? "").trim();
  const event = await getCheckinEvent(db, code);
  const parsed = checkinInput.safeParse(ourMembersOnly(event, raw));
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
  if (!checkinIsOpen(event, now)) return CLOSED;
  if (isOnlineLink(event, code)) {
    if (!parsed.data.email) return { ok: false, errors: ["Enter your email — it's how we find you for the end code and send your certificate"] };
    const given = spoken(parsed.data.spokenCode);
    if (!given) return { ok: false, errors: ["Enter the start code the host gave in the meeting"] };
    if (given !== event.startCode) return wrongCode("start");
    const r = await record(db, event, parsed.data, { source: "online", now: now.toISOString() });
    return { ...r, event, online: true };
  }
  let distanceM = null;
  if (checksNearby(event)) {
    const at = parsed.data.location;
    if (!at) return { ok: false, errors: ["Share your location to check in: this event only takes check-ins at the venue."] };
    const check = nearbyCheck(event, at);
    if (!check.ok) return { ok: false, errors: [nearbyMessage(check, event.venue)] };
    distanceM = check.distance;
  }
  const r = await record(db, event, parsed.data, { source: "qr", distanceM, now: now.toISOString() });
  return { ...r, event, online: false };
}

// The end code, entered on the online link with the email they checked in with.
export async function checkOut(db, raw, { now = new Date() } = {}) {
  const code = String(raw?.code ?? "").trim();
  const event = await getCheckinEvent(db, code);
  if (!checkinIsOpen(event, now)) return CLOSED;
  if (!isOnlineLink(event, code)) return { ok: false, errors: ["This link doesn't take end codes"] };
  if (!endCodeOpen(event, now)) {
    return event.endCodeShownAt
      ? { ok: false, errors: ["The end code has expired. Ask an organizer to count you as attended."] }
      : { ok: false, errors: ["The host hasn't given the end code yet. Stay in the meeting — it comes near the close."] };
  }
  if (spoken(raw?.spokenCode) !== event.endCode) return wrongCode("end");
  const email = String(raw?.email ?? "").trim().toLowerCase();
  const [row] = email ? await db.select().from(attendance).where(and(eq(attendance.eventId, event.id), eq(attendance.email, email))) : [];
  if (!row) return { ok: false, errors: ["We couldn't find a check-in with that email. Check in with the start code first, using the same email."] };
  if (attendedFully(row)) return { ok: true, already: true, attendee: row, event };
  const stamp = now.toISOString();
  const [done] = await db.update(attendance).set({ checkedOutAt: stamp }).where(and(eq(attendance.id, row.id), isNull(attendance.checkedOutAt))).returning();
  if (!done) return { ok: true, already: true, attendee: row, event };
  await credit(db, done, { now: stamp });
  return { ok: true, already: false, attendee: done, event };
}

// For someone who stayed but couldn't enter the end code (a dropped connection,
// a dead phone): the organizer counts them as attended.
export async function countAsStayed(db, id, { userId = null, now = new Date() } = {}) {
  const [row] = await db.select().from(attendance).where(eq(attendance.id, Number(id)));
  if (!row) return { ok: false, errors: ["Participant not found"] };
  if (attendedFully(row)) return { ok: false, errors: ["They already count as attended"] };
  const stamp = now.toISOString();
  const [done] = await db.update(attendance).set({ checkedOutAt: stamp }).where(eq(attendance.id, row.id)).returning();
  await credit(db, done, { actor: userId, now: stamp });
  return { ok: true, attendee: done };
}

export async function addAttendee(db, eventId, raw, { userId, now = new Date().toISOString() }) {
  const [event] = await db.select().from(events).where(eq(events.id, Number(eventId)));
  if (!event) return { ok: false, errors: ["Event not found"] };
  const parsed = attendeeInput.safeParse(ourMembersOnly(event, raw));
  if (!parsed.success) return { ok: false, errors: issues(parsed) };
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
  const existing = findExisting(await listAttendance(db, event.id), { name: rsvp.name, email: rsvp.email }, { rsvpId: rsvp.id });
  if (existing) {
    // An organizer ticking "attended" vouches for an online attendee who missed the end code.
    const values = attendedFully(existing) ? {} : { checkedOutAt: now };
    if (!existing.rsvpId) values.rsvpId = rsvp.id;
    if (Object.keys(values).length) await db.update(attendance).set(values).where(eq(attendance.id, existing.id));
    // They checked in first: the RSVP now holds the passport credit.
    if (!existing.rsvpId) await syncCheckinEntry(db, existing, false);
    return { ok: true, attendee: { ...existing, ...values } };
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
  // No Project Chairperson line when another organization chairs the event.
  return { president: pick("President"), secretary: pick("Secretary"), ...(event.weChair === false ? {} : { chairperson: event.chairperson || null }) };
}

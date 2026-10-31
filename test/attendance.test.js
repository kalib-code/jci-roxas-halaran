import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, passportEntries, projects, rsvps } from "@/db/schema.js";
import { saveEvent, submitRsvp, setAttendance } from "@/lib/engagement/events.js";
import {
  checkinIsOpen, setCheckin, checkIn, addAttendee, updateAttendee, removeAttendee, listAttendance,
  syncRsvpAttendance, sheetCertifiers, HOME_LO, GUEST_LO,
} from "@/lib/engagement/attendance.js";

const NOW = new Date("2027-01-15T10:30:00Z"); // 6:30 PM in Roxas, during the event
const judy = { name: "Judy J. Daliva", position: "Director for Membership", affiliation: "home", email: "judy@x.ph", consent: true };

let db;
let event;
let code;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  const [project] = await db.select().from(projects);
  await db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva"));
  event = (await saveEvent(db, { title: "General Assembly", startAt: "2027-01-15T18:00", venue: "Roxas City Hall", projectId: project.id })).event;
  ({ event } = await setCheckin(db, event.id, { open: true }));
  code = event.checkinCode;
});

const passport = () => db.select().from(passportEntries);

describe("opening check-in", () => {
  it("makes a secret link once, and a new one only when asked", async () => {
    expect(code).toMatch(/^[\w-]{12}$/);
    expect((await setCheckin(db, event.id, { open: false })).event.checkinCode).toBe(code);
    expect((await setCheckin(db, event.id, { open: true, newCode: true })).event.checkinCode).not.toBe(code);
  });

  it("closes on its own a day after the event", () => {
    expect(checkinIsOpen(event, NOW)).toBe(true);
    expect(checkinIsOpen(event, new Date("2027-01-16T09:59:00Z"))).toBe(true);
    expect(checkinIsOpen(event, new Date("2027-01-16T10:01:00Z"))).toBe(false);
    expect(checkinIsOpen({ ...event, checkinOpen: false }, NOW)).toBe(false);
  });
});

describe("QR check-in", () => {
  it("records the sheet's details with a timestamp", async () => {
    const r = await checkIn(db, { ...judy, code }, { now: NOW });
    expect(r.ok).toBe(true);
    expect(r.attendee).toMatchObject({ name: "Judy J. Daliva", position: "Director for Membership", localOrganization: HOME_LO, source: "qr", checkedInAt: NOW.toISOString() });
    expect(r.attendee.memberId).toBeTruthy();
  });

  it("takes guests from other chapters and non-members", async () => {
    await checkIn(db, { name: "Ana Reyes", position: "Local President", affiliation: "other_lo", localOrganization: "JCI Capiz", consent: true, code }, { now: NOW });
    await checkIn(db, { name: "Ben Cruz", position: "Guest", affiliation: "guest", consent: true, code }, { now: NOW });
    expect((await listAttendance(db, event.id)).map((r) => r.localOrganization)).toEqual(["JCI Capiz", GUEST_LO]);
    expect(await checkIn(db, { name: "Cara Lim", position: "Member", affiliation: "other_lo", consent: true, code }, { now: NOW })).toEqual({ ok: false, errors: ["Enter your chapter, e.g. JCI Capiz"] });
  });

  it("refuses a wrong code, a closed check-in, and missing consent", async () => {
    const closed = { ok: false, errors: ["Check-in for this event is closed"] };
    expect(await checkIn(db, { ...judy, code: "wrong-code-1" }, { now: NOW })).toEqual(closed);
    expect(await checkIn(db, { ...judy, code }, { now: new Date("2027-01-17T00:00:00Z") })).toEqual(closed);
    expect((await checkIn(db, { ...judy, consent: false, code }, { now: NOW })).ok).toBe(false);
  });

  it("counts a second scan as already checked in, by email or by name", async () => {
    await checkIn(db, { ...judy, code }, { now: NOW });
    expect((await checkIn(db, { ...judy, code }, { now: NOW })).already).toBe(true);
    expect((await checkIn(db, { ...judy, email: "", name: "  judy j.   DALIVA ", code }, { now: NOW })).already).toBe(true);
    expect(await listAttendance(db, event.id)).toHaveLength(1);
  });

  it("credits the member's passport once, through their RSVP when they have one", async () => {
    await checkIn(db, { ...judy, code }, { now: NOW });
    expect(await passport()).toMatchObject([{ refTable: "attendance", kind: "project_joined" }]);

    const ana = (await submitRsvp(db, { eventId: event.id, name: "Ana", email: "ana@x.ph", consent: true })).rsvp;
    await db.update(members).set({ email: "ana@x.ph" }).where(eq(members.slug, "lemuel-capa"));
    await checkIn(db, { name: "Ana", position: "Member", affiliation: "home", email: "ana@x.ph", consent: true, code }, { now: NOW });
    expect((await db.select().from(rsvps).where(eq(rsvps.id, ana.id)))[0].attended).toBe(true);
    expect((await passport()).map((p) => p.refTable).sort()).toEqual(["attendance", "rsvps"]);
  });
});

describe("admin changes", () => {
  it("adds walk-ins, refuses duplicates, and edits details", async () => {
    const r = await addAttendee(db, event.id, { name: "Carl Tan", position: "Guest", affiliation: "guest", localOrganization: "Capiz State University" }, { userId: "user_admin" });
    expect(r.attendee).toMatchObject({ source: "admin", addedBy: "user_admin", localOrganization: "Capiz State University" });
    // Organizers can add a second person who shares a name; the same email is refused.
    expect((await addAttendee(db, event.id, { name: "carl tan", position: "Guest", affiliation: "guest" }, { userId: "user_admin" })).ok).toBe(true);
    await updateAttendee(db, r.attendee.id, { name: "Carl Tan", position: "Guest", affiliation: "guest", email: "carl@x.ph" });
    expect(await addAttendee(db, event.id, { name: "Carlos", position: "Guest", affiliation: "guest", email: "carl@x.ph" }, { userId: "user_admin" })).toEqual({ ok: false, errors: ["Carl Tan are already on this sheet"] });
    const edited = await updateAttendee(db, r.attendee.id, { name: "Carl Tan", position: "Member", affiliation: "other_lo", localOrganization: "JCI Capiz" });
    expect(edited.attendee).toMatchObject({ position: "Member", localOrganization: "JCI Capiz" });
  });

  it("moves the passport credit when an edit changes whose email it is", async () => {
    const r = await addAttendee(db, event.id, { name: "Judy", position: "Member", affiliation: "home" }, { userId: "u" });
    expect(await passport()).toHaveLength(0);
    await updateAttendee(db, r.attendee.id, { name: "Judy", position: "Member", affiliation: "home", email: "judy@x.ph" });
    expect(await passport()).toHaveLength(1);
  });

  it("removing someone takes back their RSVP's attended mark and passport credit", async () => {
    await db.update(members).set({ email: "ana@x.ph" }).where(eq(members.slug, "lemuel-capa"));
    const rsvp = (await submitRsvp(db, { eventId: event.id, name: "Ana", email: "ana@x.ph", consent: true })).rsvp;
    const { attendee } = await checkIn(db, { name: "Ana", position: "Member", affiliation: "home", email: "ana@x.ph", consent: true, code }, { now: NOW });
    expect(await passport()).toHaveLength(1);
    await removeAttendee(db, attendee.id);
    expect((await db.select().from(rsvps).where(eq(rsvps.id, rsvp.id)))[0].attended).toBe(false);
    expect(await passport()).toHaveLength(0);
  });
});

describe("RSVPs ticked as attended", () => {
  it("join the sheet with their officer role, and leave it when unticked", async () => {
    const rsvp = (await submitRsvp(db, { eventId: event.id, name: "Judy", email: "judy@x.ph", consent: true })).rsvp;
    await setAttendance(db, rsvp.id, true, { userId: "u" });
    await syncRsvpAttendance(db, { ...rsvp, attended: true }, true, { userId: "u" });
    // No 2027 term in the seed, so a member without one is listed as "Member".
    expect(await listAttendance(db, event.id)).toMatchObject([{ name: "Judy", position: "Member", localOrganization: HOME_LO, source: "rsvp", rsvpId: rsvp.id }]);
    await syncRsvpAttendance(db, rsvp, false);
    expect(await listAttendance(db, event.id)).toHaveLength(0);
  });

  it("link to an earlier QR check-in instead of adding a second row or a second credit", async () => {
    await checkIn(db, { ...judy, code }, { now: NOW });
    const rsvp = (await submitRsvp(db, { eventId: event.id, name: "Judy", email: "judy@x.ph", consent: true })).rsvp;
    const marked = (await setAttendance(db, rsvp.id, true, { userId: "u" })).rsvp;
    const { syncAttendanceEntry } = await import("@/lib/members/passport.js");
    await syncAttendanceEntry(db, marked, true);
    await syncRsvpAttendance(db, marked, true);
    expect(await listAttendance(db, event.id)).toMatchObject([{ source: "qr", rsvpId: rsvp.id }]);
    expect((await passport()).map((p) => p.refTable)).toEqual(["rsvps"]);
  });

  it("never attach to someone else's check-in just because the name matches", async () => {
    await checkIn(db, { name: "Judy", position: "Member", affiliation: "home", consent: true, code }, { now: NOW });
    const rsvp = (await submitRsvp(db, { eventId: event.id, name: "Judy", email: "judy@x.ph", consent: true })).rsvp;
    await syncRsvpAttendance(db, rsvp, true);
    expect((await listAttendance(db, event.id)).map((r) => [r.source, r.rsvpId]).sort()).toEqual([["qr", null], ["rsvp", rsvp.id]]);
  });

  it("guess guests' details from our records, leaving the rest for an admin", async () => {
    const rsvp = (await submitRsvp(db, { eventId: event.id, name: "Stranger", email: "s@x.ph", consent: true })).rsvp;
    await syncRsvpAttendance(db, rsvp, true);
    expect((await listAttendance(db, event.id))[0]).toMatchObject({ position: "Guest", affiliation: "guest", localOrganization: GUEST_LO });
  });
});

describe("events another organization chairs", () => {
  it("record everyone as our member and drop the Project Chairperson line", async () => {
    const { event: joined } = await setCheckin(db, (await saveEvent(db, { title: "Halloween Run", startAt: "2027-01-15T17:00", weChair: false, chairperson: "Someone" })).event.id, { open: true });
    expect(joined).toMatchObject({ weChair: false, chairperson: null });
    const r = await checkIn(db, { name: "Ana Reyes", position: "Member", affiliation: "other_lo", localOrganization: "JCI Capiz", consent: true, code: joined.checkinCode }, { now: NOW });
    expect(r.attendee).toMatchObject({ affiliation: "home", localOrganization: HOME_LO });
    const certifiers = await sheetCertifiers(db, joined);
    expect(certifiers).not.toHaveProperty("chairperson");
    expect(certifiers.president).toBeTruthy();
  });
});

describe("sheetCertifiers", () => {
  it("names the President and Secretary for the event's year, or the latest board", async () => {
    const ga2026 = (await saveEvent(db, { title: "Induction", startAt: "2026-03-01T18:00" })).event;
    expect(await sheetCertifiers(db, ga2026)).toEqual({ president: "Jaime Cortes M. Altavas", secretary: "John Moses Aposaga", chairperson: null });
    const ga2025 = (await saveEvent(db, { title: "Turnover", startAt: "2025-12-01T18:00" })).event;
    expect((await sheetCertifiers(db, ga2025)).secretary).toBe("Gian Carlo L. Velado");
    expect((await sheetCertifiers(db, { ...event, chairperson: "Raymark B. Bigcas" })).president).toBe("Jaime Cortes M. Altavas");
  });
});

describe("cleanup on delete", () => {
  it("removes an event's attendance with the event", async () => {
    await checkIn(db, { ...judy, code }, { now: NOW });
    const { events: eventsTable, attendance } = await import("@/db/schema.js");
    await db.delete(eventsTable).where(and(eq(eventsTable.id, event.id)));
    expect(await db.select().from(attendance)).toHaveLength(0);
  });
});

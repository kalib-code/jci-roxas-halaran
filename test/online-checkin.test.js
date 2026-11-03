import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, passportEntries, projects, rsvps } from "@/db/schema.js";
import { saveEvent, submitRsvp } from "@/lib/engagement/events.js";
import {
  setCheckin, setCheckinNearby, showEndCode, checkIn, checkOut, countAsStayed, listAttendance, getCheckinEvent, isOnlineLink,
  attendedFully, endCodeOpen, syncRsvpAttendance,
} from "@/lib/engagement/attendance.js";
import { dueCertificates } from "@/lib/engagement/certificates.js";

// A Zoom session 7–9 PM in Roxas (11:00–13:00 UTC) on Jan 15, 2027.
const at = (iso) => new Date(iso);
const START = at("2027-01-15T11:10:00Z");
const END = at("2027-01-15T12:55:00Z");
const judy = { name: "Judy J. Daliva", position: "Director for Membership", affiliation: "home", email: "judy@x.ph", consent: true };

let db;
let event;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  await db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva"));
  const [project] = await db.select().from(projects);
  event = (await saveEvent(db, { title: "Leadership webinar", format: "online", projectId: project.id, startAt: "2027-01-15T19:00", endAt: "2027-01-15T21:00", venue: "Zoom" })).event;
  ({ event } = await setCheckin(db, event.id, { open: true }));
});

const joinOnline = (who = judy, spokenCode = event.startCode, now = START) => checkIn(db, { ...who, code: event.onlineCode, spokenCode }, { now });
const leave = (email = judy.email, spokenCode = event.endCode, now = END) => checkOut(db, { code: event.onlineCode, email, spokenCode }, { now });
const reveal = async (now = at("2027-01-15T12:50:00Z")) => ({ event } = await showEndCode(db, event.id, { now }));
const passport = () => db.select().from(passportEntries);

describe("opening check-in for an online event", () => {
  it("makes an online link and two 6-digit codes, the end code hidden until shown", async () => {
    expect(event.format).toBe("online");
    expect(event.onlineCode).toMatch(/^[\w-]{12}$/);
    expect(event.startCode).toMatch(/^\d{6}$/);
    expect(event.endCode).toMatch(/^\d{6}$/);
    expect(event.endCode).not.toBe(event.startCode);
    expect(event.endCodeShownAt).toBeNull();
    expect(endCodeOpen(event, END)).toBe(false);
  });

  it("keeps its codes when check-in closes and reopens, and makes a new online link only when asked", async () => {
    const before = event;
    await setCheckin(db, event.id, { open: false });
    const { event: again } = await setCheckin(db, event.id, { open: true });
    expect([again.onlineCode, again.startCode, again.endCode]).toEqual([before.onlineCode, before.startCode, before.endCode]);
    const { event: fresh } = await setCheckin(db, event.id, { open: true, newOnlineCode: true });
    expect(fresh.onlineCode).not.toBe(before.onlineCode);
    expect(fresh.checkinCode).toBe(before.checkinCode);
  });

  it("treats every link to an online event as the online one", async () => {
    expect(isOnlineLink(await getCheckinEvent(db, event.onlineCode), event.onlineCode)).toBe(true);
    expect(isOnlineLink(await getCheckinEvent(db, event.checkinCode), event.checkinCode)).toBe(true);
    const r = await checkIn(db, { ...judy, code: event.checkinCode }, { now: START });
    expect(r).toEqual({ ok: false, errors: ["Enter the start code the host gave in the meeting"] });
  });
});

describe("joining with the start code", () => {
  it("puts them on the sheet as online, without credit until they stay", async () => {
    const r = await joinOnline();
    expect(r).toMatchObject({ ok: true, online: true, attendee: { name: "Judy J. Daliva", source: "online", checkedOutAt: null } });
    expect(attendedFully(r.attendee)).toBe(false);
    expect(await passport()).toHaveLength(0);
  });

  it("refuses a wrong start code and a missing email", async () => {
    expect(await joinOnline(judy, "000000")).toEqual({ ok: false, errors: ["That isn't the start code — check what the host said or showed"] });
    expect(await joinOnline({ ...judy, email: "" })).toEqual({ ok: false, errors: ["Enter your email — it's how we find you for the end code and send your certificate"] });
  });

  it("accepts the code typed with spaces", async () => {
    const spaced = `${event.startCode.slice(0, 3)} ${event.startCode.slice(3)}`;
    expect((await joinOnline(judy, spaced)).ok).toBe(true);
  });

  it("never asks for the venue location", async () => {
    expect((await setCheckinNearby(db, event.id, { nearby: true, lat: 11.585, lng: 122.751 })).ok).toBe(true);
    expect((await joinOnline()).ok).toBe(true);
  });
});

describe("staying to the end", () => {
  it("won't take the end code before the host shows it", async () => {
    await joinOnline();
    expect(await leave()).toEqual({ ok: false, errors: ["The host hasn't given the end code yet. Stay in the meeting — it comes near the close."] });
  });

  it("records the time out and gives the passport credit once", async () => {
    await joinOnline();
    await reveal();
    const r = await leave();
    expect(r).toMatchObject({ ok: true, already: false });
    const [row] = await listAttendance(db, event.id);
    expect(row.checkedOutAt).toBe(END.toISOString());
    expect(attendedFully(row)).toBe(true);
    expect(await passport()).toHaveLength(1);
    expect(await leave()).toMatchObject({ ok: true, already: true });
    expect(await passport()).toHaveLength(1);
  });

  it("marks their RSVP attended at the end, not at the start", async () => {
    await submitRsvp(db, { eventId: event.id, name: judy.name, email: judy.email, consent: true });
    await joinOnline();
    expect((await db.select().from(rsvps))[0].attended).toBe(false);
    await reveal();
    await leave();
    expect((await db.select().from(rsvps))[0].attended).toBe(true);
  });

  it("refuses a wrong end code, the start code, and an email that never checked in", async () => {
    await joinOnline();
    await reveal();
    expect(await leave(judy.email, "000000")).toEqual({ ok: false, errors: ["That isn't the end code — check what the host said or showed"] });
    expect(await leave(judy.email, event.startCode)).toEqual({ ok: false, errors: ["That isn't the end code — check what the host said or showed"] });
    expect(await leave("nobody@x.ph")).toEqual({ ok: false, errors: ["We couldn't find a check-in with that email. Check in with the start code first, using the same email."] });
  });

  it("stops taking the end code an hour after it's shown", async () => {
    await joinOnline();
    await reveal(at("2027-01-15T12:50:00Z"));
    expect(endCodeOpen(event, at("2027-01-15T13:50:00Z"))).toBe(true);
    expect(endCodeOpen(event, at("2027-01-15T13:51:00Z"))).toBe(false);
    expect((await leave(judy.email, event.endCode, at("2027-01-15T13:51:00Z"))).ok).toBe(false);
  });

  it("lets an organizer count someone as stayed, e.g. when their connection dropped", async () => {
    const { attendee } = await joinOnline();
    const r = await countAsStayed(db, attendee.id, { now: END });
    expect(r.attendee.checkedOutAt).toBe(END.toISOString());
    expect(await passport()).toHaveLength(1);
    expect(await countAsStayed(db, attendee.id, { now: END })).toEqual({ ok: false, errors: ["They already count as attended"] });
  });

  it("an RSVP ticked as attended counts as stayed", async () => {
    const { rsvp } = await submitRsvp(db, { eventId: event.id, name: judy.name, email: judy.email, consent: true });
    await joinOnline();
    await syncRsvpAttendance(db, rsvp, true, { now: END.toISOString() });
    const [row] = await listAttendance(db, event.id);
    expect(attendedFully(row)).toBe(true);
  });
});

describe("certificates for online attendees", () => {
  it("go only to people who entered both codes", async () => {
    await joinOnline();
    await joinOnline({ ...judy, name: "Ana Reyes", email: "ana@x.ph" });
    await reveal();
    await leave("ana@x.ph");
    const due = await dueCertificates(db, { now: at("2027-01-15T14:00:00Z") });
    expect(due.map((d) => d.attendee.name)).toEqual(["Ana Reyes"]);
  });
});

describe("hybrid events", () => {
  let hybrid;
  beforeEach(async () => {
    hybrid = (await saveEvent(db, { title: "General Assembly", format: "hybrid", startAt: "2027-01-15T19:00", endAt: "2027-01-15T21:00", venue: "Roxas City Hall" })).event;
    ({ event: hybrid } = await setCheckin(db, hybrid.id, { open: true }));
  });

  it("take the room QR without codes and the online link with them, on one sheet", async () => {
    expect(isOnlineLink(hybrid, hybrid.checkinCode)).toBe(false);
    expect(isOnlineLink(hybrid, hybrid.onlineCode)).toBe(true);
    const room = await checkIn(db, { ...judy, code: hybrid.checkinCode }, { now: START });
    expect(room).toMatchObject({ ok: true, online: false, attendee: { source: "qr" } });
    expect(attendedFully(room.attendee)).toBe(true);
    const online = await checkIn(db, { ...judy, name: "Ana Reyes", email: "ana@x.ph", code: hybrid.onlineCode, spokenCode: hybrid.startCode }, { now: START });
    expect(online).toMatchObject({ ok: true, online: true, attendee: { source: "online" } });
    expect((await listAttendance(db, hybrid.id)).map((r) => r.source)).toEqual(["qr", "online"]);
  });

  it("won't take the end code through the room QR", async () => {
    ({ event: hybrid } = await showEndCode(db, hybrid.id, { now: END }));
    expect(await checkOut(db, { code: hybrid.checkinCode, email: judy.email, spokenCode: hybrid.endCode }, { now: END })).toEqual({ ok: false, errors: ["This link doesn't take end codes"] });
  });
});

describe("in-person events", () => {
  it("get no online link or codes", async () => {
    const room = (await saveEvent(db, { title: "Clean-up", startAt: "2027-01-15T07:00" })).event;
    const { event: opened } = await setCheckin(db, room.id, { open: true });
    expect(opened.format).toBe("in_person");
    expect([opened.onlineCode, opened.startCode, opened.endCode]).toEqual([null, null, null]);
    expect(await showEndCode(db, room.id)).toEqual({ ok: false, errors: ["This event has no online check-in"] });
  });
});

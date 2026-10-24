import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { eventsLog } from "@/db/schema.js";
import { saveEvent, submitRsvp, listEvents, getEventBySlug, setAttendance, submitVolunteer, listRsvps, listVolunteers } from "@/lib/engagement/events.js";

const now = "2026-11-01T00:00:00.000Z";
let db;
let ga;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  ga = (await saveEvent(db, { title: "General Assembly", startAt: "2027-01-15T18:00", capacity: 1, venue: "Roxas City" }, { now })).event;
});

const rsvp = (email, extra = {}) => submitRsvp(db, { eventId: ga.id, name: "Ana Cruz", email, consent: true, ...extra }, { now });

describe("events", () => {
  it("creates an event with a slug that stays after edits", async () => {
    expect(ga.slug).toBe("general-assembly");
    const e = await saveEvent(db, { id: ga.id, expectedUpdatedAt: ga.updatedAt, title: "General Assembly 2027", startAt: "2027-01-15T18:00" }, { now });
    expect(e.event.slug).toBe("general-assembly");
  });

  it("splits upcoming and past events by Philippine time", async () => {
    await saveEvent(db, { title: "Induction", startAt: "2026-10-20T18:00" }, { now });
    const { upcoming, past } = await listEvents(db, { now: new Date(now) });
    expect(upcoming.map((e) => e.slug)).toEqual(["general-assembly"]);
    expect(past.map((e) => e.slug)).toEqual(["induction"]);
  });
});

describe("RSVPs", () => {
  it("puts people on the waitlist once the event is full", async () => {
    expect((await rsvp("a@x.ph")).status).toBe("going");
    expect((await rsvp("b@x.ph")).status).toBe("waitlist");
    expect(await getEventBySlug(db, "general-assembly")).toMatchObject({ going: 1, waitlist: 1 });
  });

  it("treats the same email in different case as a duplicate", async () => {
    await rsvp("Juan@Gmail.com");
    expect(await rsvp("juan@gmail.com")).toEqual({ ok: false, errors: ["You're already on the list for this event"] });
  });

  it("refuses RSVPs when they are closed", async () => {
    await saveEvent(db, { id: ga.id, expectedUpdatedAt: ga.updatedAt, title: "General Assembly", startAt: "2027-01-15T18:00", rsvpOpen: false }, { now });
    expect(await rsvp("c@x.ph")).toEqual({ ok: false, errors: ["RSVPs are closed for this event"] });
  });

  it("logs RSVPs and attendance", async () => {
    const { rsvp: r } = await rsvp("a@x.ph");
    await setAttendance(db, r.id, true, { userId: "admin", now });
    expect((await listRsvps(db, ga.id))[0].attended).toBe(true);
    expect((await db.select().from(eventsLog)).map((l) => l.type)).toEqual(["rsvp_created", "attendance_marked"]);
  });
});

describe("volunteers", () => {
  it("records a sign-up for an event", async () => {
    const r = await submitVolunteer(db, { eventId: ga.id, name: "Ana Cruz", email: "a@x.ph", skills: "Photography", consent: true }, { now });
    expect(r.ok).toBe(true);
  });

  it("lists sign-ups newest first with what they signed up for", async () => {
    await submitVolunteer(db, { eventId: ga.id, name: "Ana Cruz", email: "a@x.ph", consent: true }, { now: "2026-10-01T00:00:00Z" });
    await submitVolunteer(db, { eventId: ga.id, name: "Ben Reyes", email: "b@x.ph", skills: "Driving", consent: true }, { now: "2026-10-02T00:00:00Z" });
    const list = await listVolunteers(db);
    expect(list.map((v) => v.name)).toEqual(["Ben Reyes", "Ana Cruz"]);
    expect(list[0]).toMatchObject({ skills: "Driving", eventTitle: ga.title, eventId: ga.id, projectTitle: null });
  });
});

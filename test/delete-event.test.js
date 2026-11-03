import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { attendance, events, members, passportEntries, projects, rsvps, volunteerSignups } from "@/db/schema.js";
import { saveEvent, submitRsvp, deleteEvent, getEvent } from "@/lib/engagement/events.js";
import { setCheckin, checkIn } from "@/lib/engagement/attendance.js";
import { saveDrive, submitDriveSignup, draftFromEvent, getDrive } from "@/lib/engagement/volunteers.js";

const now = "2026-11-01T00:00:00.000Z";
const judy = { name: "Judy J. Daliva", position: "Director for Membership", affiliation: "home", email: "judy@x.ph", consent: true };

let db;
let test;
let keep;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  await db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva"));
  const [project] = await db.select().from(projects);
  test = (await saveEvent(db, { title: "Test event", projectId: project.id, startAt: "2026-11-05T18:00" }, { now })).event;
  keep = (await saveEvent(db, { title: "General Assembly", startAt: "2026-11-20T18:00" }, { now })).event;
});

describe("deleting an event", () => {
  it("removes it with its RSVPs, attendance and the passport credit they gave", async () => {
    await submitRsvp(db, { eventId: test.id, name: judy.name, email: judy.email, consent: true }, { now });
    ({ event: test } = await setCheckin(db, test.id, { open: true }));
    await checkIn(db, { ...judy, code: test.checkinCode }, { now: new Date("2026-11-05T10:30:00Z") });
    expect(await db.select().from(passportEntries)).toHaveLength(1);

    expect(await deleteEvent(db, test.id)).toMatchObject({ ok: true, event: { title: "Test event" } });
    expect(await getEvent(db, test.id)).toBeNull();
    expect(await db.select().from(rsvps)).toEqual([]);
    expect(await db.select().from(attendance)).toEqual([]);
    expect(await db.select().from(passportEntries)).toEqual([]);
  });

  it("keeps its volunteer registrations and volunteers, just unlinked", async () => {
    const drive = (await saveDrive(db, draftFromEvent(test), { now })).drive;
    await submitDriveSignup(db, { driveId: drive.id, name: "Ana Cruz", email: "a@x.ph", consent: true }, { now });
    await deleteEvent(db, test.id);
    expect((await getDrive(db, drive.id)).eventId).toBeNull();
    const [signup] = await db.select().from(volunteerSignups);
    expect(signup).toMatchObject({ email: "a@x.ph", eventId: null });
  });

  it("leaves other events alone", async () => {
    await submitRsvp(db, { eventId: keep.id, name: judy.name, email: judy.email, consent: true }, { now });
    await deleteEvent(db, test.id);
    const titles = (await db.select().from(events)).map((e) => e.title);
    expect(titles).toContain("General Assembly");
    expect(titles).not.toContain("Test event");
    expect(await db.select().from(rsvps)).toHaveLength(1);
  });

  it("says so when the event is already gone", async () => {
    await deleteEvent(db, test.id);
    expect(await deleteEvent(db, test.id)).toEqual({ ok: false, errors: ["That event was already deleted"] });
  });
});

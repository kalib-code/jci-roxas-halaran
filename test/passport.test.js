import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, passportEntries } from "@/db/schema.js";
import { requestEntry, verifyEntry, declineEntry, addVerifiedEntry, getPassport, computeBadges, syncAttendanceEntry, listRequestedEntries } from "@/lib/members/passport.js";
import { saveEvent, submitRsvp } from "@/lib/engagement/events.js";
import { listProjects } from "@/lib/queries.js";

const now = "2026-11-01T00:00:00.000Z";
let db;
let judy;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  [judy] = await db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva")).returning();
});

describe("passport entries", () => {
  it("lets a member request an entry that an admin verifies with adjusted points", async () => {
    const { entry } = await requestEntry(db, judy.id, { kind: "training", title: "Effective Communication", date: "2026-10-05" }, { userId: "user_j", now });
    expect(entry).toMatchObject({ status: "requested", points: 2 });
    expect((await listRequestedEntries(db))[0]).toMatchObject({ memberName: "Judy Daliva" });
    const r = await verifyEntry(db, entry.id, { userId: "admin", points: 3, now });
    expect(r.entry).toMatchObject({ status: "verified", points: 3, verifiedBy: "admin" });
  });

  it("refuses to review an entry twice", async () => {
    const { entry } = await requestEntry(db, judy.id, { kind: "award", title: "Star Member", date: "2026-10-05" }, { userId: "user_j", now });
    await declineEntry(db, entry.id, { userId: "admin", now });
    expect(await verifyEntry(db, entry.id, { userId: "admin", now })).toEqual({ ok: false, errors: ["This entry was already reviewed"] });
  });

  it("validates the request", async () => {
    expect((await requestEntry(db, judy.id, { kind: "training", title: "x", date: "" }, { userId: "u", now })).ok).toBe(false);
  });
});

describe("getPassport", () => {
  it("adds officer positions, totals points and computes badges", async () => {
    await addVerifiedEntry(db, judy.id, { kind: "project_led", title: "Coastal Cleanup", date: "2026-06-20" }, { userId: "admin", now });
    await addVerifiedEntry(db, judy.id, { kind: "training", title: "Leadership 101", date: "2026-05-01" }, { userId: "admin", now });
    const p = await getPassport(db, judy.id);
    expect(p.positions).toEqual([{ role: "Director for Membership", year: 2026 }]);
    expect(p.points).toBe(5 + 2 + 3);
    expect(p.badges.map((b) => b.label)).toEqual(["First steps", "Trained ×1", "Project chair ×1", "Officer"]);
    expect(p.entries.map((e) => e.title)).toEqual(["Coastal Cleanup", "Leadership 101"]);
  });

  it("awards Ten trainings at ten", () => {
    const ten = Array.from({ length: 10 }, () => ({ kind: "training" }));
    expect(computeBadges(ten, 0).map((b) => b.key)).toContain("ten-trainings");
  });
});

describe("syncAttendanceEntry", () => {
  it("adds one entry for attending a project event and removes it when unticked", async () => {
    const [project] = await listProjects(db, { limit: 1 });
    const { event } = await saveEvent(db, { title: "Mural Painting", startAt: "2026-08-07T08:00", projectId: project.id }, { now });
    const { rsvp } = await submitRsvp(db, { eventId: event.id, name: "Judy Daliva", email: "judy@x.ph", consent: true }, { now });
    await syncAttendanceEntry(db, rsvp, true, { now });
    await syncAttendanceEntry(db, rsvp, true, { now });
    let rows = await db.select().from(passportEntries);
    expect(rows).toEqual([expect.objectContaining({ kind: "project_joined", title: "Mural Painting", date: "2026-08-07", status: "verified" })]);
    await syncAttendanceEntry(db, rsvp, false, { now });
    rows = await db.select().from(passportEntries);
    expect(rows).toEqual([]);
  });

  it("does nothing for events without a project or attendees who are not members", async () => {
    const { event } = await saveEvent(db, { title: "Social Night", startAt: "2026-08-07T18:00" }, { now });
    const { rsvp } = await submitRsvp(db, { eventId: event.id, name: "Judy Daliva", email: "judy@x.ph", consent: true }, { now });
    expect((await syncAttendanceEntry(db, rsvp, true, { now })).added).toBe(false);
  });
});

describe("points validation", () => {
  it("refuses negative or fractional points from admins", async () => {
    const bad = "Points must be a whole number from 0 to 100";
    expect(await addVerifiedEntry(db, judy.id, { kind: "training", title: "Leadership 101", date: "2026-05-01" }, { userId: "admin", points: -5 })).toEqual({ ok: false, errors: [bad] });
    const { entry } = await requestEntry(db, judy.id, { kind: "training", title: "Leadership 101", date: "2026-05-01" }, { userId: "u" });
    expect(await verifyEntry(db, entry.id, { userId: "admin", points: 2.5 })).toEqual({ ok: false, errors: [bad] });
    expect((await verifyEntry(db, entry.id, { userId: "admin", points: 0 })).entry.points).toBe(0);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { saveEvent, listVolunteers } from "@/lib/engagement/events.js";
import {
  saveDrive, getDrive, getDriveBySlug, listDrives, listOpenDrivesFor, submitDriveSignup, listDriveSignups,
  removeDriveSignup, confirmDriveSignup, driveIsOpen, draftFromEvent,
} from "@/lib/engagement/volunteers.js";

const now = "2026-11-01T00:00:00.000Z";
let db;
let ga;
let drive;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  ga = (await saveEvent(db, { title: "General Assembly", startAt: "2027-01-15T18:00", venue: "Roxas City" }, { now })).event;
  drive = (await saveDrive(db, {
    ...draftFromEvent(ga),
    roles: [{ label: "Registration desk", slots: 1 }, { label: "Photographer", description: "Bring a camera" }],
  }, { now })).drive;
});

const signUp = (email, extra = {}) =>
  submitDriveSignup(db, { driveId: drive.id, roleId: drive.roles[0].id, name: "Ana Cruz", email, consent: true, ...extra }, { now });

describe("volunteer registrations", () => {
  it("starts from the event's details", () => {
    expect(draftFromEvent(ga)).toMatchObject({ title: "Volunteers for General Assembly", eventId: ga.id, startsAt: "2027-01-15T18:00", venue: "Roxas City", closesOn: "2027-01-15" });
  });

  it("saves a registration with its roles in order and a lasting address", async () => {
    expect(drive.slug).toBe("volunteers-for-general-assembly");
    expect(drive.roles.map((r) => [r.label, r.slots])).toEqual([["Registration desk", 1], ["Photographer", null]]);
    const r = await saveDrive(db, { id: drive.id, expectedUpdatedAt: drive.updatedAt, title: "GA helpers", roles: [{ ...drive.roles[1] }, { ...drive.roles[0], slots: 3 }] }, { now: "2026-11-02T00:00:00Z" });
    expect(r.drive.slug).toBe("volunteers-for-general-assembly");
    expect(r.drive.roles.map((x) => [x.label, x.slots])).toEqual([["Photographer", null], ["Registration desk", 3]]);
  });

  it("refuses an address that's already used", async () => {
    expect(await saveDrive(db, { title: "Volunteers for General Assembly" }, { now })).toEqual({
      ok: false,
      errors: ["The address /volunteer/volunteers-for-general-assembly is taken — try volunteers-for-general-assembly-2"],
    });
  });

  it("refuses a stale save", async () => {
    expect(await saveDrive(db, { id: drive.id, expectedUpdatedAt: "old", title: "x" }, { now })).toEqual({ ok: false, errors: ["This was changed since you opened it — reload"] });
  });

  it("won't delete a role that has volunteers", async () => {
    await signUp("a@x.ph");
    const r = await saveDrive(db, { id: drive.id, expectedUpdatedAt: drive.updatedAt, title: drive.title, roles: [drive.roles[1]] }, { now });
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain('"Registration desk" has 1 volunteer');
    expect((await getDrive(db, drive.id)).roles).toHaveLength(2);
  });

  it("deletes an empty role", async () => {
    const r = await saveDrive(db, { id: drive.id, expectedUpdatedAt: drive.updatedAt, title: drive.title, roles: [drive.roles[0]] }, { now });
    expect(r.drive.roles.map((x) => x.label)).toEqual(["Registration desk"]);
  });

  it("closes after the last day in Philippine time, or when switched off", () => {
    const d = { open: true, closesOn: "2027-01-15" };
    expect(driveIsOpen(d, { now: new Date("2027-01-15T15:59:00Z") })).toBe(true); // 11:59 pm in Manila
    expect(driveIsOpen(d, { now: new Date("2027-01-15T16:00:00Z") })).toBe(false);
    expect(driveIsOpen({ ...d, open: false }, { now: new Date(now) })).toBe(false);
  });

  it("lists registrations with their counts and the open ones for an event", async () => {
    await signUp("a@x.ph");
    const [listed] = await listDrives(db);
    expect(listed).toMatchObject({ title: "Volunteers for General Assembly", eventTitle: "General Assembly", confirmed: 1, spots: null });
    expect((await listOpenDrivesFor(db, { eventId: ga.id }, { now: new Date(now) })).map((d) => d.id)).toEqual([drive.id]);
    expect(await listOpenDrivesFor(db, { eventId: ga.id }, { now: new Date("2027-02-01T00:00:00Z") })).toEqual([]);
  });
});

describe("signing up through a registration", () => {
  it("records the volunteer against the role, event and registration", async () => {
    const r = await signUp("A@X.ph", { phone: "0917", skills: "First aid" });
    expect(r).toMatchObject({ ok: true, status: "confirmed", role: { label: "Registration desk" } });
    expect(r.signup).toMatchObject({ driveId: drive.id, eventId: ga.id, email: "a@x.ph" });
    const [row] = await listVolunteers(db);
    expect(row).toMatchObject({ driveTitle: "Volunteers for General Assembly", roleLabel: "Registration desk", eventTitle: "General Assembly" });
    expect((await getDriveBySlug(db, drive.slug)).roles[0].taken).toBe(1);
  });

  it("asks for a role when the registration has roles", async () => {
    expect(await signUp("a@x.ph", { roleId: "" })).toEqual({ ok: false, errors: ["Choose how you'd like to help"] });
  });

  it("allows one sign-up per email", async () => {
    await signUp("a@x.ph", { roleId: drive.roles[1].id });
    expect(await signUp("A@x.ph", { roleId: drive.roles[1].id })).toEqual({ ok: false, errors: ["You've already signed up for this — we'll be in touch"] });
  });

  it("refuses sign-ups once closed", async () => {
    await saveDrive(db, { id: drive.id, expectedUpdatedAt: drive.updatedAt, title: drive.title, open: false, roles: drive.roles }, { now });
    expect(await signUp("a@x.ph")).toEqual({ ok: false, errors: ["Sign-ups for this are closed"] });
  });

  it("takes anyone when there are no roles", async () => {
    const open = (await saveDrive(db, { title: "Coastal clean-up" }, { now })).drive;
    const r = await submitDriveSignup(db, { driveId: open.id, name: "Ben Reyes", email: "b@x.ph", consent: true }, { now });
    expect(r).toMatchObject({ ok: true, status: "confirmed", role: null });
  });

  it("lets an organizer remove or confirm a volunteer", async () => {
    const { signup } = await signUp("a@x.ph");
    expect(await confirmDriveSignup(db, signup.id)).toEqual({ ok: false, errors: ["Already confirmed"] });
    expect((await removeDriveSignup(db, signup.id)).ok).toBe(true);
    expect(await listDriveSignups(db, drive.id)).toEqual([]);
  });
});

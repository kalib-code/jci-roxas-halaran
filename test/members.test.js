import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { memberForUser } from "@/lib/members/link.js";
import { updateProfile, listDirectory, normalizeSkills, adminUpdateMember } from "@/lib/members/profile.js";
import { saveEvent, submitRsvp, listRsvpsForEmail } from "@/lib/engagement/events.js";

let db;
const judy = async () => (await db.select().from(members).where(eq(members.slug, "judy-daliva")))[0];
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  await db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva"));
});

describe("memberForUser", () => {
  it("links by email on first sign-in, then finds by Clerk id", async () => {
    const linked = await memberForUser(db, { clerkUserId: "user_j", email: "Judy@X.ph" });
    expect(linked).toMatchObject({ slug: "judy-daliva", clerkUserId: "user_j" });
    expect((await memberForUser(db, { clerkUserId: "user_j", email: null })).slug).toBe("judy-daliva");
  });

  it("never lets a second account take over a linked record", async () => {
    await memberForUser(db, { clerkUserId: "user_j", email: "judy@x.ph" });
    expect(await memberForUser(db, { clerkUserId: "user_other", email: "judy@x.ph" })).toBeNull();
    expect((await judy()).clerkUserId).toBe("user_j");
  });

  it("returns null without a match", async () => {
    expect(await memberForUser(db, { clerkUserId: "user_z", email: "nobody@x.ph" })).toBeNull();
  });
});

describe("profiles", () => {
  it("cleans up skills", () => {
    expect(normalizeSkills(" Photography, logistics ,, Photography, first aid ")).toBe("Photography, logistics, first aid");
  });

  it("updates only the given member and keeps the photo unless a new one is sent", async () => {
    const before = await judy();
    const r = await updateProfile(db, before.id, { profession: "Teacher", skills: "Public speaking", bio: "Hi", inDirectory: true });
    expect(r.member).toMatchObject({ profession: "Teacher", skills: "Public speaking", inDirectory: true, photoUrl: before.photoUrl });
    expect((await db.select().from(members).where(eq(members.slug, "manuel-luis-luna")))[0].profession).toBeNull();
  });

  it("refuses photos from other hosts", async () => {
    const r = await updateProfile(db, (await judy()).id, { photoUrl: "https://evil.example/x.jpg" });
    expect(r).toEqual({ ok: false, errors: ["Upload a photo"] });
  });

  it("lets admins edit email, status and directory flag", async () => {
    const r = await adminUpdateMember(db, (await judy()).id, { email: " NEW@x.ph ", status: "alumni", inDirectory: false });
    expect(r.member).toMatchObject({ email: "new@x.ph", status: "alumni", inDirectory: false });
  });
});

describe("directory", () => {
  beforeEach(async () => {
    await updateProfile(db, (await judy()).id, { profession: "Teacher", skills: "Photography", inDirectory: true });
  });

  it("lists only opted-in active members", async () => {
    expect((await listDirectory(db)).map((m) => m.name)).toEqual(["Judy Daliva"]);
  });

  it("searches name, profession, business and skills, case-insensitively", async () => {
    expect((await listDirectory(db, { q: "PHOTO" })).length).toBe(1);
    expect((await listDirectory(db, { q: "teach" })).length).toBe(1);
    expect((await listDirectory(db, { q: "welding" })).length).toBe(0);
  });

  it("treats % and _ literally", async () => {
    expect((await listDirectory(db, { q: "%" })).length).toBe(0);
    expect((await listDirectory(db, { q: "_" })).length).toBe(0);
  });

  it("never returns email or phone", async () => {
    const [row] = await listDirectory(db);
    expect(row.email).toBeUndefined();
  });
});

describe("listRsvpsForEmail", () => {
  it("returns a member's RSVPs with their events", async () => {
    const { event } = await saveEvent(db, { title: "GA", startAt: "2099-01-15T18:00" });
    await submitRsvp(db, { eventId: event.id, name: "Judy Daliva", email: "JUDY@x.ph", consent: true });
    const rows = await listRsvpsForEmail(db, "judy@x.ph");
    expect(rows).toEqual([expect.objectContaining({ title: "GA", slug: "ga", status: "going", attended: false })]);
  });
});

describe("admin link control", () => {
  it("lets an admin unlink a wrongly linked account", async () => {
    await memberForUser(db, { clerkUserId: "user_wrong", email: "judy@x.ph" });
    const r = await adminUpdateMember(db, (await judy()).id, { email: "judy@x.ph", status: "active", inDirectory: false, unlink: true });
    expect(r.member.clerkUserId).toBeNull();
  });

  it("drops the link when an admin changes a linked member's email", async () => {
    await memberForUser(db, { clerkUserId: "user_wrong", email: "judy@x.ph" });
    const r = await adminUpdateMember(db, (await judy()).id, { email: "real.judy@x.ph", status: "active", inDirectory: false });
    expect(r.member).toMatchObject({ email: "real.judy@x.ph", clerkUserId: null });
  });

  it("keeps the link when the email is unchanged", async () => {
    await memberForUser(db, { clerkUserId: "user_j", email: "judy@x.ph" });
    const r = await adminUpdateMember(db, (await judy()).id, { email: "JUDY@x.ph", status: "senator", inDirectory: false });
    expect(r.member.clerkUserId).toBe("user_j");
  });
});

describe("directory card links", () => {
  it("tells the directory which members have a published card", async () => {
    const id = (await judy()).id;
    await updateProfile(db, id, { profession: "Teacher", inDirectory: true, cardPublished: true, cardConsent: true });
    const [row] = await listDirectory(db, { q: "teacher" });
    expect(row).toMatchObject({ slug: "judy-daliva", cardPublished: true });
  });
});

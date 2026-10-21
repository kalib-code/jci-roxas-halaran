import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, eventsLog } from "@/db/schema.js";
import { submitApplication, approveApplication, declineApplication, listApplications } from "@/lib/engagement/applications.js";

const now = "2026-11-01T02:00:00.000Z";
const ana = { name: "Ana Cruz", email: "Ana@Example.ph", birthdate: "1998-04-12", consent: true };
let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("submitApplication", () => {
  it("saves a pending application with a lower-cased email and logs it", async () => {
    const r = await submitApplication(db, ana, { now });
    expect(r.application).toMatchObject({ email: "ana@example.ph", status: "pending" });
    expect((await db.select().from(eventsLog)).map((l) => l.type)).toEqual(["application_submitted"]);
  });

  it("accepts 18 today and 40 until the day before 41; refuses 17 and 41", async () => {
    const at = (birthdate) => submitApplication(db, { ...ana, email: `${birthdate}@x.ph`, birthdate }, { now });
    expect((await at("2008-11-01")).ok).toBe(true); // turned 18 today
    expect((await at("1985-11-02")).ok).toBe(true); // 40, turns 41 tomorrow
    expect(await at("2008-11-02")).toEqual({ ok: false, errors: ["JCI membership is for ages 18 to 40"] }); // turns 18 tomorrow
    expect(await at("1985-10-31")).toEqual({ ok: false, errors: ["JCI membership is for ages 18 to 40"] }); // turned 41 yesterday
  });

  it("refuses a second pending application but allows a new one after a decline", async () => {
    const first = await submitApplication(db, ana, { now });
    expect(await submitApplication(db, ana, { now })).toEqual({ ok: false, errors: ["You already have a pending application — we'll be in touch soon"] });
    await declineApplication(db, first.application.id, { userId: "admin", now });
    expect((await submitApplication(db, ana, { now })).ok).toBe(true);
  });
});

describe("approveApplication", () => {
  it("creates the member, invites them and logs the approval", async () => {
    const { application } = await submitApplication(db, ana, { now });
    const invite = vi.fn(async () => {});
    const r = await approveApplication(db, application.id, { userId: "admin", now, invite });
    expect(r).toMatchObject({ ok: true, invited: true, inviteError: null });
    expect(r.member).toMatchObject({ name: "Ana Cruz", email: "ana@example.ph", slug: "ana-cruz", joinedAt: "2026-11-01" });
    expect(invite).toHaveBeenCalledWith("ana@example.ph");
    expect((await listApplications(db))[0].status).toBe("approved");
  });

  it("links an existing member with the same email instead of duplicating", async () => {
    await db.update(members).set({ email: "ana@example.ph" }).where(eq(members.slug, "judy-daliva"));
    const { application } = await submitApplication(db, ana, { now });
    const r = await approveApplication(db, application.id, { userId: "admin", now, invite: async () => {} });
    expect(r.member.slug).toBe("judy-daliva");
    expect((await db.select().from(members)).length).toBe(17);
  });

  it("keeps the approval when the invitation fails", async () => {
    const { application } = await submitApplication(db, ana, { now });
    const r = await approveApplication(db, application.id, { userId: "admin", now, invite: async () => { throw new Error("Clerk down"); } });
    expect(r).toMatchObject({ ok: true, invited: false, inviteError: "Clerk down" });
  });

  it("refuses to review the same application twice", async () => {
    const { application } = await submitApplication(db, ana, { now });
    await approveApplication(db, application.id, { userId: "admin", now });
    expect(await approveApplication(db, application.id, { userId: "admin", now })).toEqual({ ok: false, errors: ["This application was already reviewed"] });
  });
});

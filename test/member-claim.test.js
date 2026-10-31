import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { auditLog, members } from "@/db/schema.js";
import { claimMembership } from "@/lib/members/claim.js";

let db;
const raise = vi.fn(async () => true);
const user = ({ role, email = "joses@x.ph", status = "verified" } = {}) => async () => ({
  publicMetadata: role ? { role } : {},
  primaryEmailAddress: { emailAddress: email, verification: { status } },
  emailAddresses: [],
});

beforeEach(async () => {
  db = await testDb();
  await seed(db);
  raise.mockClear();
  await db.update(members).set({ email: "joses@x.ph" }).where(eq(members.slug, "jaime-altavas"));
  await db.update(members).set({ email: "plain@x.ph" }).where(eq(members.slug, "john-paul-sorongon"));
});

describe("first sign-in without a role", () => {
  it("links an officer's account by verified email and makes them admin", async () => {
    const r = await claimMembership(db, "user_new", { loadUser: user(), raise });
    expect(r).toMatchObject({ ok: true, role: "admin" });
    expect(raise).toHaveBeenCalledWith("user_new", "admin");
    expect((await db.select().from(members).where(eq(members.slug, "jaime-altavas")))[0].clerkUserId).toBe("user_new");
    expect(await db.select().from(auditLog)).toMatchObject([{ actorId: "system", action: "member.claim" }]);
  });

  it("gives other members member access", async () => {
    expect(await claimMembership(db, "user_2", { loadUser: user({ email: "Plain@X.ph" }), raise })).toMatchObject({ ok: true, role: "member" });
  });

  it("says why when the email isn't verified or isn't a member's", async () => {
    expect(await claimMembership(db, "u", { loadUser: user({ status: "unverified" }), raise })).toEqual({ ok: false, reason: "unverified" });
    expect(await claimMembership(db, "u", { loadUser: user({ email: "stranger@x.ph" }), raise })).toEqual({ ok: false, reason: "no-member", email: "stranger@x.ph" });
    expect(raise).not.toHaveBeenCalled();
  });

  it("leaves accounts that already have a role alone", async () => {
    expect(await claimMembership(db, "u", { loadUser: user({ role: "member" }), raise })).toEqual({ ok: true, already: true });
    expect(raise).not.toHaveBeenCalled();
  });
});

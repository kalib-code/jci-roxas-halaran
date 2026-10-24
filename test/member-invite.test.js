import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { inviteUnlinkedMembers } from "@/lib/members/invite.js";

let db;
const bySlug = async (slug) => (await db.select().from(members).where(eq(members.slug, slug)))[0];

beforeEach(async () => {
  db = await testDb();
  await seed(db);
  await db.update(members).set({ email: null });
  await db.update(members).set({ email: " Judy@X.ph " }).where(eq(members.slug, "judy-daliva"));
  await db.update(members).set({ email: "manuel@x.ph" }).where(eq(members.slug, "manuel-luis-luna"));
});

describe("inviting unlinked members", () => {
  it("invites only members with an email and no account, sending a clean address", async () => {
    await db.update(members).set({ clerkUserId: "user_done" }).where(eq(members.slug, "manuel-luis-luna"));
    const invite = vi.fn(async () => ({ invited: true }));
    const r = await inviteUnlinkedMembers(db, { invite });
    expect(invite).toHaveBeenCalledTimes(1);
    expect(invite).toHaveBeenCalledWith("judy@x.ph");
    expect(r.invited).toEqual([(await bySlug("judy-daliva")).name]);
    expect(r.withoutEmail.length).toBeGreaterThan(0);
  });

  it("links members who already signed up instead of inviting them", async () => {
    const invite = async (email) => (email === "judy@x.ph" ? { clerkUserId: "user_judy" } : { invited: true });
    const r = await inviteUnlinkedMembers(db, { invite });
    expect((await bySlug("judy-daliva")).clerkUserId).toBe("user_judy");
    expect(r.linked).toHaveLength(1);
    expect(r.invited).toHaveLength(1);
  });

  it("keeps going when one invitation fails, reporting Clerk's message", async () => {
    const invite = async (email) => {
      if (email === "judy@x.ph") throw Object.assign(new Error("Unprocessable"), { errors: [{ longMessage: "Email is invalid" }] });
      return { invited: true };
    };
    const r = await inviteUnlinkedMembers(db, { invite });
    expect(r.failed).toEqual([{ name: (await bySlug("judy-daliva")).name, error: "Email is invalid" }]);
    expect(r.invited).toHaveLength(1);
  });
});

describe("matching an existing Clerk account", () => {
  it("only trusts an address the account has verified", async () => {
    const { ownsEmail } = await import("@/lib/clerk-invite.js");
    const user = (status) => ({ emailAddresses: [{ emailAddress: "Judy@X.ph", verification: { status } }] });
    expect(ownsEmail(user("verified"), "judy@x.ph")).toBe(true);
    expect(ownsEmail(user("unverified"), "judy@x.ph")).toBe(false);
    expect(ownsEmail(user("verified"), "other@x.ph")).toBe(false);
  });
});

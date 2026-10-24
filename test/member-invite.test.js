import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { inviteUnlinkedMembers } from "@/lib/members/invite.js";
import { currentBoardMembers, currentBoardEmails } from "@/lib/members/board.js";
import { shouldRaise } from "@/lib/clerk-invite.js";

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
    expect(invite.mock.calls[0][0]).toBe("judy@x.ph");
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

describe("the board gets admin automatically", () => {
  it("invites current board members as admin and everyone else as member", async () => {
    const board = await currentBoardMembers(db);
    const boardIds = new Set(board.map((b) => b.id));
    const outsider = (await db.select().from(members)).find((m) => !boardIds.has(m.id));
    await db.update(members).set({ email: null });
    await db.update(members).set({ email: "board@x.ph" }).where(eq(members.id, board[0].id));
    await db.update(members).set({ email: "out@x.ph" }).where(eq(members.id, outsider.id));
    const invite = vi.fn(async () => ({ invited: true }));
    const r = await inviteUnlinkedMembers(db, { invite });
    expect(Object.fromEntries(invite.mock.calls.map(([email, o]) => [email, o.role]))).toEqual({ "board@x.ph": "admin", "out@x.ph": "member" });
    expect(r.admins).toEqual([board[0].name]);
  });

  it("raises board members who already have an account, but not anyone else", async () => {
    const board = await currentBoardMembers(db);
    const boardIds = new Set(board.map((b) => b.id));
    const outsider = (await db.select().from(members)).find((m) => !boardIds.has(m.id));
    await db.update(members).set({ clerkUserId: "user_b" }).where(eq(members.id, board[0].id));
    await db.update(members).set({ clerkUserId: "user_o" }).where(eq(members.id, outsider.id));
    const raise = vi.fn(async () => true);
    await inviteUnlinkedMembers(db, { invite: async () => ({ invited: true }), raise });
    expect(raise.mock.calls).toEqual([["user_b", "admin"]]);
  });

  it("lists the board's emails for info@ forwarding, cleaned and without duplicates", async () => {
    const board = await currentBoardMembers(db);
    await db.update(members).set({ email: null });
    await db.update(members).set({ email: " Pres@X.ph " }).where(eq(members.id, board[0].id));
    await db.update(members).set({ email: "pres@x.ph" }).where(eq(members.id, board[1].id));
    expect(await currentBoardEmails(db)).toEqual(["pres@x.ph"]);
  });

  it("only ever raises a role", () => {
    expect(shouldRaise(undefined, "member")).toBe(true);
    expect(shouldRaise("member", "admin")).toBe(true);
    expect(shouldRaise("officer", "admin")).toBe(true);
    expect(shouldRaise("admin", "member")).toBe(false);
    expect(shouldRaise("treasurer", "member")).toBe(false);
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

import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, officerTerms } from "@/db/schema.js";
import { boardYear, currentBoardMembers, adminBoardMembers, isAdminBoardMember, currentBoardEmails } from "@/lib/members/board.js";
import { inviteUnlinkedMembers } from "@/lib/members/invite.js";
import { getCurrentBoard } from "@/lib/queries.js";

const OCT_2026 = new Date("2026-10-31T04:00:00Z");
const JAN_2027 = new Date("2026-12-31T16:30:00Z"); // 12:30 AM on Jan 1, 2027 in Roxas

let db;
const bySlug = async (slug) => (await db.select().from(members).where(eq(members.slug, slug)))[0];

// The 2027 board elected in late 2026: Jasper as President and a new member as Director.
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  const [carl] = await db.insert(members).values({ slug: "carl-binondo", name: "Carl Vincent Binondo", email: "carl@x.ph" }).returning();
  await db.insert(officerTerms).values([
    { memberId: (await bySlug("jasper-sayo")).id, role: "President", year: 2027, sort: 0 },
    { memberId: carl.id, role: "Director", year: 2027, sort: 8 },
  ]);
});

describe("which board is in office", () => {
  it("keeps the 2026 board until 2027 starts in the Philippines", async () => {
    expect(await boardYear(db, { now: OCT_2026 })).toBe(2026);
    expect(await boardYear(db, { now: JAN_2027 })).toBe(2027);
    expect((await getCurrentBoard(db, { now: OCT_2026 })).president.name).toBe("Jaime Cortes M. Altavas");
    expect((await getCurrentBoard(db, { now: JAN_2027 })).president.name).toBe("Jasper T. Sayo");
  });

  it("sends info@ mail to the board in office only", async () => {
    await db.update(members).set({ email: "jaime@x.ph" }).where(eq(members.slug, "jaime-altavas"));
    const emails = await currentBoardEmails(db, { now: OCT_2026 });
    expect(emails).toContain("jaime@x.ph");
    expect(emails).not.toContain("carl@x.ph");
    expect((await currentBoardMembers(db, { now: OCT_2026 })).every((m) => m.year === 2026)).toBe(true);
  });
});

describe("who gets admin", () => {
  it("is everyone on this year's board and next year's, once each", async () => {
    const admins = await adminBoardMembers(db, { now: OCT_2026 });
    const names = admins.map((a) => a.name);
    expect(names).toContain("Jaime Cortes M. Altavas");
    expect(names).toContain("Carl Vincent Binondo");
    expect(names.filter((n) => n === "Jasper T. Sayo")).toHaveLength(1);
    expect(names).not.toContain("John Paul Sorongon"); // 2024 President only
    expect(await isAdminBoardMember(db, (await bySlug("carl-binondo")).id, { now: OCT_2026 })).toBe(true);
    expect(await isAdminBoardMember(db, (await bySlug("john-paul-sorongon")).id, { now: OCT_2026 })).toBe(false);
  });

  it("invites next year's officers as admin and skips anyone already invited", async () => {
    await db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva"));
    const invite = vi.fn(async () => ({ invited: true }));
    const r = await inviteUnlinkedMembers(db, { invite, pending: new Set(["judy@x.ph"]) });
    expect(invite).toHaveBeenCalledWith("carl@x.ph", { role: "admin" });
    expect(invite).not.toHaveBeenCalledWith("judy@x.ph", expect.anything());
    expect(r.alreadyInvited).toEqual(["Judy J. Daliva"]);
  });
});

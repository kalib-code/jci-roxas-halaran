import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { auditLog, members, officerTerms } from "@/db/schema.js";

let db;
let role = "member";
const raiseRole = vi.fn(async () => true);
vi.mock("@/lib/db.js", async (importOriginal) => ({ ...(await importOriginal()), getDb: () => db }));
vi.mock("@/lib/auth.js", () => ({ requireArea: async () => ({ userId: "user_1", role }) }));
let verified = "verified";
vi.mock("@/lib/clerk-user.js", async (importOriginal) => ({
  ...(await importOriginal()),
  loadClerkUser: async () => ({ primaryEmailAddress: { emailAddress: "officer@x.ph", verification: { status: verified } } }),
}));
vi.mock("@/lib/clerk-invite.js", () => ({ raiseRole: (...a) => raiseRole(...a) }));
const { currentMember } = await import("@/lib/members/current.js");

beforeEach(async () => {
  db = await testDb();
  await seed(db);
  raiseRole.mockClear();
  role = "member";
  verified = "verified";
});

describe("officers signing in", () => {
  it("get admin the first time they open the member area", async () => {
    await db.update(members).set({ email: "officer@x.ph" }).where(eq(members.slug, "jaime-altavas"));
    const r = await currentMember();
    expect(r.member.slug).toBe("jaime-altavas");
    expect(r.role).toBe("admin");
    expect(raiseRole).toHaveBeenCalledWith("user_1", "admin");
    expect(await db.select().from(auditLog)).toMatchObject([{ actorId: "system", action: "member.auto_admin" }]);
  });

  it("only link and promote through an address Clerk has verified", async () => {
    verified = "unverified";
    await db.update(members).set({ email: "officer@x.ph" }).where(eq(members.slug, "jaime-altavas"));
    expect((await currentMember()).member).toBeNull();
    expect(raiseRole).not.toHaveBeenCalled();
  });

  it("ignore an officer term more than a year ahead", async () => {
    const [ana] = await db.insert(members).values({ slug: "ana", name: "Ana", email: "officer@x.ph" }).returning();
    await db.insert(officerTerms).values({ memberId: ana.id, role: "President", year: 2072, sort: 0 });
    expect((await currentMember()).role).toBe("member");
  });

  it("leaves members who aren't officers, and admins, as they are", async () => {
    await db.update(members).set({ email: "officer@x.ph" }).where(eq(members.slug, "john-paul-sorongon"));
    expect((await currentMember()).role).toBe("member");
    role = "admin";
    await db.update(members).set({ email: null, clerkUserId: null }).where(eq(members.slug, "john-paul-sorongon"));
    await db.update(members).set({ email: "officer@x.ph" }).where(eq(members.slug, "jaime-altavas"));
    await currentMember();
    expect(raiseRole).not.toHaveBeenCalled();
  });
});

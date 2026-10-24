import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { audit, changedFields, listAudit } from "@/lib/audit.js";
import { submitApplication } from "@/lib/engagement/applications.js";

const h = vi.hoisted(() => ({ db: null }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: "user_admin", sessionClaims: { metadata: { role: "admin" } } }),
  clerkClient: async () => ({
    users: { getUser: async () => ({ publicMetadata: {} }), getUserList: async () => ({ data: [] }), updateUserMetadata: async () => ({}) },
    invitations: { createInvitation: async () => ({}) },
  }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/db.js", async (orig) => ({ ...(await orig()), getDb: () => h.db }));

const { updateMemberAction } = await import("@/app/admin/members/actions.js");
const { approveApplicationAction } = await import("@/app/admin/applications/actions.js");

beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
});

describe("audit log", () => {
  it("lists entries newest first with the admin's member name", async () => {
    const [judy] = await h.db.select().from(members).where(eq(members.slug, "judy-daliva"));
    await h.db.update(members).set({ clerkUserId: "user_admin" }).where(eq(members.id, judy.id));
    await audit(h.db, { actor: "user_admin", action: "a.one", summary: "first", now: "2026-10-01T00:00:00Z" });
    await audit(h.db, { actor: "user_other", action: "a.two", summary: "second", details: { x: [1, 2] }, now: "2026-10-02T00:00:00Z" });
    const { rows, total } = await listAudit(h.db);
    expect(total).toBe(2);
    expect(rows.map((r) => [r.summary, r.actorName])).toEqual([["second", null], ["first", judy.name]]);
    expect(rows[0].details).toEqual({ x: [1, 2] });
  });

  it("never throws, even when the write fails", async () => {
    const broken = { insert: () => { throw new Error("no table"); } };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(audit(broken, { actor: "u", action: "x", summary: "s" })).resolves.toBeUndefined();
    spy.mockRestore();
  });

  it("reports only the fields that changed", () => {
    expect(changedFields({ email: "a", status: "active" }, { email: "b", status: "active" }, ["email", "status"])).toEqual({ email: ["a", "b"] });
    expect(changedFields({ email: null }, { email: undefined }, ["email"])).toEqual({});
  });

  it("logs a member edit with the before and after values", async () => {
    const [m] = await h.db.select().from(members).where(eq(members.slug, "judy-daliva"));
    await h.db.update(members).set({ email: "old@x.ph" }).where(eq(members.id, m.id));
    await updateMemberAction(m.id, { email: "new@x.ph", status: "active", inDirectory: m.inDirectory });
    const { rows } = await listAudit(h.db);
    expect(rows[0]).toMatchObject({ action: "member.update", actorId: "user_admin", targetTable: "members", targetId: m.id });
    expect(rows[0].summary).toBe(`Changed ${m.name}'s email`);
    expect(rows[0].details.email).toEqual(["old@x.ph", "new@x.ph"]);
  });

  it("logs nothing when a save changes nothing", async () => {
    const [m] = await h.db.select().from(members).where(eq(members.slug, "judy-daliva"));
    await updateMemberAction(m.id, { email: m.email ?? "", status: m.status, inDirectory: m.inDirectory });
    expect((await listAudit(h.db)).total).toBe(0);
  });

  it("logs an application approval", async () => {
    const { application } = await submitApplication(h.db, { name: "Ana Cruz", email: "a@x.ph", birthdate: "1998-01-01", consent: true });
    await approveApplicationAction(application.id);
    const { rows } = await listAudit(h.db);
    expect(rows[0]).toMatchObject({ action: "application.approve", summary: "Approved Ana Cruz's application and sent an invitation" });
  });
});

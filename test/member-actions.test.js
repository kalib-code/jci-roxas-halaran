import { describe, it, expect, vi, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, passportEntries } from "@/db/schema.js";

const h = vi.hoisted(() => ({ db: null, claims: null, email: null, revalidated: [] }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.claims ? "user_j" : null, sessionClaims: h.claims }),
  clerkClient: async () => ({ users: { getUser: async () => ({ publicMetadata: {}, primaryEmailAddress: h.email ? { emailAddress: h.email } : null, emailAddresses: [] }) } }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));
vi.mock("@/lib/db.js", async (orig) => ({ ...(await orig()), getDb: () => h.db }));

const { updateProfileAction, requestEntryAction } = await import("@/app/members/actions.js");
const { verifyEntryAction } = await import("@/app/admin/members/actions.js");

beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  await h.db.update(members).set({ email: "judy@x.ph" }).where(eq(members.slug, "judy-daliva"));
  h.claims = { metadata: { role: "member" } };
  h.email = "judy@x.ph";
  h.revalidated = [];
});

const bySlug = async (slug) => (await h.db.select().from(members).where(eq(members.slug, slug)))[0];

describe("member actions", () => {
  it("update the signed-in member's own profile, ignoring any id sent from the browser", async () => {
    const other = await bySlug("manuel-luis-luna");
    const r = await updateProfileAction({ id: other.id, memberId: other.id, profession: "Engineer", inDirectory: true });
    expect(r).toEqual({ ok: true });
    expect((await bySlug("judy-daliva")).profession).toBe("Engineer");
    expect((await bySlug("manuel-luis-luna")).profession).toBeNull();
  });

  it("explain when the account has no member profile", async () => {
    h.email = "stranger@x.ph";
    expect(await updateProfileAction({ profession: "x" })).toEqual({ ok: false, errors: ["Your account isn't linked to a member profile yet — ask an admin."] });
  });

  it("refuse signed-out callers", async () => {
    h.claims = null;
    await expect(updateProfileAction({})).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("let members request passport entries but not verify them", async () => {
    expect((await requestEntryAction({ kind: "training", title: "Leadership 101", date: "2026-10-01" })).ok).toBe(true);
    const [entry] = await h.db.select().from(passportEntries);
    await expect(verifyEntryAction(entry.id)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

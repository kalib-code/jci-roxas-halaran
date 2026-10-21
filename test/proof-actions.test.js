import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { listProjects } from "@/lib/queries.js";

const h = vi.hoisted(() => ({ db: null, claims: null, revalidated: [] }));
vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.claims ? "user_1" : null, sessionClaims: h.claims }),
  clerkClient: async () => ({ users: { getUser: async () => ({ publicMetadata: {} }) } }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));
vi.mock("@/lib/db.js", async (orig) => ({ ...(await orig()), getDb: () => h.db }));

const { setProjectMetricsAction } = await import("@/app/admin/projects/actions.js");
const { saveSnapshotAction } = await import("@/app/admin/evidence/actions.js");

beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  h.revalidated = [];
});

describe("proof admin actions", () => {
  it("refuse officers", async () => {
    h.claims = { metadata: { role: "officer" } };
    await expect(setProjectMetricsAction(1, [])).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(saveSnapshotAction({ month: "2026-11" })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("save metrics and refresh the impact page and the project", async () => {
    h.claims = { metadata: { role: "admin" } };
    const [p] = await listProjects(h.db, { limit: 1 });
    expect((await setProjectMetricsAction(p.id, [{ metric: "trees_planted", value: 10 }])).ok).toBe(true);
    expect(h.revalidated).toEqual(expect.arrayContaining(["/impact", `/projects/${p.slug}`, "/"]));
  });

  it("save an analytics snapshot", async () => {
    h.claims = { metadata: { role: "admin" } };
    expect(await saveSnapshotAction({ month: "2026-11", organicClicks: "10" })).toEqual({ ok: true });
  });
});

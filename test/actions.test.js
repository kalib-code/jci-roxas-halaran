import { describe, it, expect, vi, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";

const h = vi.hoisted(() => ({ db: null, claims: null, revalidated: [] }));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: h.claims ? "user_1" : null, sessionClaims: h.claims }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: (p) => h.revalidated.push(p) }));
vi.mock("@/lib/db.js", async (importOriginal) => ({ ...(await importOriginal()), getDb: () => h.db }));

const { saveArticleAction, publishArticleAction } = await import("@/app/admin/articles/actions.js");

const complete = {
  title: "Rizal Day",
  metaDescription: "What Filipinos commemorate on December 30.",
  targetKeyword: "rizal day",
  bodyHtml: "<p>José Rizal.</p>",
};

beforeEach(async () => {
  h.db = await testDb();
  await seed(h.db);
  h.revalidated = [];
});

describe("article actions", () => {
  it("refuse officers", async () => {
    h.claims = { metadata: { role: "officer" } };
    await expect(saveArticleAction(complete)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("refuse signed-out callers", async () => {
    h.claims = null;
    await expect(saveArticleAction(complete)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("let admins save drafts without refreshing public pages", async () => {
    h.claims = { metadata: { role: "admin" } };
    const r = await saveArticleAction(complete);
    expect(r.ok).toBe(true);
    expect(h.revalidated).toEqual([]);
  });

  it("refresh the article's public pages on publish", async () => {
    h.claims = { metadata: { role: "admin" } };
    const saved = await saveArticleAction(complete);
    const r = await publishArticleAction(saved.article.id, saved.article.updatedAt);
    expect(r.ok).toBe(true);
    expect(h.revalidated).toEqual(["/articles", "/articles/rizal-day", "/", "/sitemap.xml"]);
  });
});

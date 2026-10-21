import { describe, it, expect } from "vitest";
import { testDb } from "./helpers/db.js";
import { members, officerTerms, projects, faqs, articles, seoPlan } from "@/db/schema.js";

describe("schema", () => {
  it("stores and reads a member with defaults", async () => {
    const db = await testDb();
    await db.insert(members).values({ slug: "judy-daliva", name: "Judy Daliva" });
    const [row] = await db.select().from(members);
    expect(row.status).toBe("active");
    expect(row.inDirectory).toBe(false);
  });

  it("rejects duplicate slugs", async () => {
    const db = await testDb();
    await db.insert(projects).values({ slug: "coastline-cuts", title: "Coastline Cuts" });
    await expect(
      db.insert(projects).values({ slug: "coastline-cuts", title: "Copy" }),
    ).rejects.toThrow();
  });

  it("rejects the same person holding the same role twice in one year", async () => {
    const db = await testDb();
    const [m] = await db
      .insert(members)
      .values({ slug: "jasper-sayo", name: "Jasper L. Sayo" })
      .returning();
    await db.insert(officerTerms).values({ memberId: m.id, role: "Vice President", year: 2026 });
    await expect(
      db.insert(officerTerms).values({ memberId: m.id, role: "Vice President", year: 2026 }),
    ).rejects.toThrow();
  });

  it("rejects duplicate FAQ questions", async () => {
    const db = await testDb();
    await db.insert(faqs).values({ question: "What is JCI?", answer: "A" });
    await expect(db.insert(faqs).values({ question: "What is JCI?", answer: "B" })).rejects.toThrow();
  });

  it("rejects duplicate article slugs", async () => {
    const db = await testDb();
    await db.insert(articles).values({ slug: "rizal-day", title: "Rizal Day", updatedAt: "2026-10-21T00:00:00Z" });
    await expect(
      db.insert(articles).values({ slug: "rizal-day", title: "Copy", updatedAt: "2026-10-21T00:00:00Z" }),
    ).rejects.toThrow();
  });

  it("allows a keyword only once per month in the SEO plan", async () => {
    const db = await testDb();
    await db.insert(seoPlan).values({ month: "2026-11", keyword: "rizal day" });
    await db.insert(seoPlan).values({ month: "2026-12", keyword: "rizal day" });
    await expect(db.insert(seoPlan).values({ month: "2026-11", keyword: "rizal day" })).rejects.toThrow();
  });

  it("defaults new articles to draft", async () => {
    const db = await testDb();
    await db.insert(articles).values({ slug: "a", title: "A", updatedAt: "2026-10-21T00:00:00Z" });
    const [row] = await db.select().from(articles);
    expect(row.status).toBe("draft");
  });
});

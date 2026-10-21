import { describe, it, expect } from "vitest";
import { testDb } from "./helpers/db.js";
import { members, officerTerms, projects, faqs } from "@/db/schema.js";

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
});

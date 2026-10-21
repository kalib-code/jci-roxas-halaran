import { describe, it, expect } from "vitest";
import { eq, count } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members, officerTerms, projects, faqs, awards, sponsors } from "@/db/schema.js";

const total = async (db, table) => (await db.select({ n: count() }).from(table))[0].n;

describe("seed", () => {
  it("loads all migrated content", async () => {
    const db = await testDb();
    await seed(db);
    expect(await total(db, members)).toBe(17);
    expect(await total(db, officerTerms)).toBe(26);
    expect(await total(db, projects)).toBe(11);
    expect(await total(db, faqs)).toBe(9);
    expect(await total(db, awards)).toBe(4);
    expect(await total(db, sponsors)).toBe(4);
  });

  it("can run twice without duplicating anything", async () => {
    const db = await testDb();
    await seed(db);
    await seed(db);
    expect(await total(db, members)).toBe(17);
    expect(await total(db, officerTerms)).toBe(26);
    expect(await total(db, projects)).toBe(11);
  });

  it("never overwrites content edited after the first run", async () => {
    const db = await testDb();
    await seed(db);
    await db.update(projects).set({ title: "Coastline Cuts 2026" }).where(eq(projects.slug, "coastline-cuts"));
    await seed(db);
    const [row] = await db.select().from(projects).where(eq(projects.slug, "coastline-cuts"));
    expect(row.title).toBe("Coastline Cuts 2026");
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { members } from "@/db/schema.js";

// Runs the copy statements from 0009 against members saved under the old four columns.
const copy = readFileSync("db/migrations/0009_member_links.sql", "utf8").split("--> statement-breakpoint").slice(1);

describe("0009 member links migration", () => {
  it("moves the fixed link columns into the list, in card order, and leaves others empty", async () => {
    const db = await testDb();
    await db.insert(members).values([
      { slug: "ana", name: "Ana", websiteUrl: "https://ana.ph/", instagramUrl: "https://instagram.com/ana", facebookUrl: "https://facebook.com/ana" },
      { slug: "ben", name: "Ben" },
    ]);
    for (const stmt of copy) await db.run(sql.raw(stmt));
    const links = async (slug) => (await db.select().from(members).where(eq(members.slug, slug)))[0].links;
    expect(await links("ana")).toEqual([
      { label: "Facebook", url: "https://facebook.com/ana" },
      { label: "Instagram", url: "https://instagram.com/ana" },
      { label: "Website", url: "https://ana.ph/" },
    ]);
    expect(await links("ben")).toBeNull();
  });
});

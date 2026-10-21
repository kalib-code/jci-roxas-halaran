import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { projects } from "@/db/schema.js";
import { parseProjectFile, importProjects } from "@/db/import-projects.js";

const file = (slug, extra = "") => `---
title: Coastline Cuts
slug: ${slug}
summary: Free haircuts for fisherfolk families along the coast.
startDate: 2026-06-20
barangay: Baybay
${extra}---
<p>The story.</p>
`;

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("project import", () => {
  it("rejects bad dates and unknown pillars", () => {
    expect(() => parseProjectFile(file("x", "startDate: June 20\n").replace("startDate: 2026-06-20\n", ""))).toThrow("startDate");
    expect(() => parseProjectFile(file("x", "pillar: sports\n"))).toThrow("pillar");
  });

  it("adds new projects and fills only empty fields on existing ones", async () => {
    const [before] = await db.select().from(projects).where(eq(projects.slug, "coastline-cuts"));
    const result = await importProjects(db, [parseProjectFile(file("coastline-cuts")), parseProjectFile(file("oplan-kaagapay"))]);
    expect(result.added).toEqual(["oplan-kaagapay"]);
    expect(result.filled).toEqual(["coastline-cuts (summary, body, barangay)"]);

    const [after] = await db.select().from(projects).where(eq(projects.slug, "coastline-cuts"));
    expect(after).toMatchObject({ title: before.title, startDate: before.startDate, body: "<p>The story.</p>", barangay: "Baybay" });

    await db.update(projects).set({ summary: "Edited by an officer" }).where(eq(projects.id, after.id));
    expect((await importProjects(db, [parseProjectFile(file("coastline-cuts"))])).unchanged).toEqual(["coastline-cuts"]);
    const [kept] = await db.select().from(projects).where(eq(projects.id, after.id));
    expect(kept.summary).toBe("Edited by an officer");
  });

  it("ships valid project files", () => {
    const dir = "content/projects";
    if (!existsSync(dir)) return;
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".html"))) {
      const p = parseProjectFile(readFileSync(`${dir}/${f}`, "utf8"));
      expect(`${p.slug}.html`).toBe(f);
      if (p.coverUrl) expect(existsSync(`public${p.coverUrl}`), p.coverUrl).toBe(true);
    }
  });
});

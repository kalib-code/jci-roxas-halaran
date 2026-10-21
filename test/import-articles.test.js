import { describe, it, expect, beforeEach } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { articles, seoPlan } from "@/db/schema.js";
import { parseArticleFile, importArticles } from "@/db/import-articles.js";
import { publishProblems } from "@/lib/content/validation.js";
import { SEO_PLAN } from "@/db/seed-data.js";

const file = `---
title: Rizal Day
slug: rizal-day
metaDescription: What Filipinos commemorate on December 30.
targetKeyword: rizal day
category: holidays
---
<p>José Rizal.</p><script>alert(1)</script>
`;

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("article import", () => {
  it("parses the header and body", () => {
    expect(parseArticleFile(file)).toMatchObject({ slug: "rizal-day", category: "holidays", bodyHtml: expect.stringContaining("<p>José Rizal.</p>") });
    expect(() => parseArticleFile("<p>no header</p>")).toThrow("--- header block");
    expect(() => parseArticleFile(file.replace("category: holidays\n", ""))).toThrow('"category"');
  });

  it("adds a sanitized draft, refreshes it while untouched, and never overwrites an officer's edit", async () => {
    expect(await importArticles(db, [parseArticleFile(file)])).toEqual({ added: ["rizal-day"], refreshed: [], skipped: [] });
    const [a] = await db.select().from(articles).where(eq(articles.slug, "rizal-day"));
    expect(a).toMatchObject({ status: "draft", bodyHtml: "<p>José Rizal.</p>" });
    const [plan] = await db.select().from(seoPlan).where(eq(seoPlan.keyword, "rizal day"));
    expect(plan).toMatchObject({ status: "drafting", articleId: a.id });
    const edited = parseArticleFile(file.replace("<p>José Rizal.</p>", "<p>Updated.</p>"));
    expect(await importArticles(db, [edited])).toEqual({ added: [], refreshed: ["rizal-day"], skipped: [] });
    expect((await db.select().from(articles).where(eq(articles.id, a.id)))[0].bodyHtml).toBe("<p>Updated.</p>");

    await db.update(articles).set({ bodyHtml: "<p>Officer edit.</p>", updatedBy: "user_1" }).where(eq(articles.id, a.id));
    expect(await importArticles(db, [parseArticleFile(file)])).toEqual({ added: [], refreshed: [], skipped: ["rizal-day"] });
    expect((await db.select().from(articles).where(eq(articles.id, a.id)))[0].bodyHtml).toBe("<p>Officer edit.</p>");
  });

  it("ships one publishable draft per planned keyword", () => {
    const dir = "content/articles";
    const parsed = readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => parseArticleFile(readFileSync(`${dir}/${f}`, "utf8")));
    expect(parsed.map((a) => a.targetKeyword).sort()).toEqual(SEO_PLAN.map((p) => p.keyword).sort());
    for (const a of parsed) {
      expect(publishProblems(a), a.slug).toEqual([]);
      if (a.coverUrl) expect(existsSync(`public${a.coverUrl}`), a.coverUrl).toBe(true);
    }
  });
});

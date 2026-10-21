import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { seoPlan } from "@/db/schema.js";
import {
  saveArticle,
  publishArticle,
  unpublishArticle,
  listPublishedArticles,
  getPublishedArticle,
  relatedArticles,
} from "@/lib/content/articles.js";

const ctx = { userId: "user_admin", now: "2026-11-01T00:00:00.000Z" };
const complete = {
  title: "Bonifacio Day: History and Meaning",
  metaDescription: "Why the Philippines remembers Andrés Bonifacio every November 30.",
  targetKeyword: "Bonifacio Day",
  category: "holidays",
  bodyJson: "{}",
  bodyHtml: '<p>Andrés Bonifacio founded the Katipunan.</p><script>x()</script>',
};

let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

async function published(fields = complete) {
  const saved = await saveArticle(db, fields, ctx);
  return publishArticle(db, saved.article.id, { expectedUpdatedAt: saved.article.updatedAt }, ctx);
}

describe("saveArticle", () => {
  it("saves a draft with a slug from the title and a cleaned body", async () => {
    const r = await saveArticle(db, complete, ctx);
    expect(r.ok).toBe(true);
    expect(r.article).toMatchObject({ slug: "bonifacio-day-history-and-meaning", status: "draft", updatedBy: "user_admin" });
    expect(r.article.bodyHtml).toBe("<p>Andrés Bonifacio founded the Katipunan.</p>");
  });

  it("saves an empty draft", async () => {
    const r = await saveArticle(db, {}, ctx);
    expect(r.ok).toBe(true);
    expect(r.article.slug).toMatch(/^untitled/);
  });

  it("refuses a slug another article already uses", async () => {
    await saveArticle(db, complete, ctx);
    const r = await saveArticle(db, { ...complete, title: "Other", slug: "bonifacio-day-history-and-meaning" }, ctx);
    expect(r).toEqual({ ok: false, errors: ["The address /articles/bonifacio-day-history-and-meaning is taken — try bonifacio-day-history-and-meaning-2"] });
  });

  it("refuses to overwrite a newer save", async () => {
    const first = await saveArticle(db, complete, ctx);
    await saveArticle(db, { id: first.article.id, expectedUpdatedAt: first.article.updatedAt, ...complete, title: "B" }, { ...ctx, now: "2026-11-02T00:00:00.000Z" });
    const stale = await saveArticle(db, { id: first.article.id, expectedUpdatedAt: first.article.updatedAt, ...complete, title: "C" }, ctx);
    expect(stale).toEqual({ ok: false, errors: ["This was changed since you opened it — reload"] });
  });

  it("keeps the slug when a published article's title changes", async () => {
    const pub = await published();
    const edited = await saveArticle(db, { id: pub.article.id, expectedUpdatedAt: pub.article.updatedAt, ...complete, title: "Bonifacio Day 2026", slug: "new-slug" }, ctx);
    expect(edited.article.slug).toBe("bonifacio-day-history-and-meaning");
  });
});

describe("publishArticle", () => {
  it("refuses an incomplete article and lists what is missing", async () => {
    const draft = await saveArticle(db, { title: "Only a title" }, ctx);
    const r = await publishArticle(db, draft.article.id, { expectedUpdatedAt: draft.article.updatedAt }, ctx);
    expect(r).toEqual({ ok: false, errors: ["Add a meta description", "Add a target keyword", "Write the article body"] });
  });

  it("publishes and links the SEO plan row even when the keyword case differs", async () => {
    const r = await published();
    expect(r.article).toMatchObject({ status: "published", publishedAt: ctx.now });
    const [row] = await db.select().from(seoPlan).where(eq(seoPlan.keyword, "bonifacio day"));
    expect(row).toMatchObject({ status: "published", articleId: r.article.id });
  });
});

describe("public queries", () => {
  it("never return drafts", async () => {
    await saveArticle(db, { ...complete, title: "Draft only" }, ctx);
    const pub = await published();
    expect((await listPublishedArticles(db)).map((a) => a.id)).toEqual([pub.article.id]);
    expect(await getPublishedArticle(db, "draft-only")).toBeNull();
  });

  it("unpublishing hides the article and resets its plan row to drafting", async () => {
    const pub = await published();
    await unpublishArticle(db, pub.article.id, ctx);
    expect(await getPublishedArticle(db, pub.article.slug)).toBeNull();
    const [row] = await db.select().from(seoPlan).where(eq(seoPlan.keyword, "bonifacio day"));
    expect(row.status).toBe("drafting");
  });

  it("filters by category and finds related articles", async () => {
    const a = await published();
    const b = await published({ ...complete, title: "Rizal Day", targetKeyword: "rizal day" });
    await published({ ...complete, title: "Capiz Shells", targetKeyword: "capiz shells", category: "capiz" });
    expect((await listPublishedArticles(db, { category: "capiz" })).map((x) => x.title)).toEqual(["Capiz Shells"]);
    expect((await relatedArticles(db, a.article)).map((x) => x.id)).toEqual([b.article.id]);
  });

  it("includes the author's name and falls back to null", async () => {
    const r = await published();
    expect((await getPublishedArticle(db, r.article.slug)).authorName).toBeNull();
  });
});

import { and, desc, eq, ne } from "drizzle-orm";
import { articles, members } from "../../db/schema.js";
import { articleInput, publishProblems } from "./validation.js";
import { cleanHtml } from "../sanitize.js";
import { slugify } from "../format.js";
import { linkPublishedArticle, unlinkArticle } from "./seoPlan.js";

const STALE = "This was changed since you opened it — reload";

export async function getArticle(db, id) {
  const [row] = await db.select().from(articles).where(eq(articles.id, Number(id)));
  return row ?? null;
}

export function listArticlesAdmin(db, { status } = {}) {
  const q = db.select().from(articles).orderBy(desc(articles.updatedAt));
  return status ? q.where(eq(articles.status, status)) : q;
}

async function slugTaken(db, slug, id) {
  const cond = id ? and(eq(articles.slug, slug), ne(articles.id, id)) : eq(articles.slug, slug);
  return (await db.select({ id: articles.id }).from(articles).where(cond)).length > 0;
}

export async function saveArticle(db, { id, expectedUpdatedAt, ...raw }, { userId, now = new Date().toISOString() }) {
  const parsed = articleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const data = parsed.data;

  const existing = id ? await getArticle(db, id) : null;
  if (id && !existing) return { ok: false, errors: ["Article not found"] };
  if (existing && expectedUpdatedAt !== existing.updatedAt) return { ok: false, errors: [STALE] };

  // Slug is locked once the article has ever been published (spec §3).
  let slug = existing?.publishedAt ? existing.slug : slugify(data.slug || data.title);
  if (!slug) slug = `untitled-${Date.parse(now)}`;
  if (!existing?.publishedAt && (await slugTaken(db, slug, existing?.id))) {
    return { ok: false, errors: [`The address /articles/${slug} is taken — try ${slug}-2`] };
  }

  const values = {
    title: data.title || "Untitled",
    slug,
    metaDescription: data.metaDescription || null,
    targetKeyword: data.targetKeyword || null,
    category: data.category,
    bodyJson: data.bodyJson || null,
    bodyHtml: cleanHtml(data.bodyHtml),
    coverUrl: data.coverUrl || null,
    coverAlt: data.coverAlt || null,
    authorId: data.authorId,
    projectId: data.projectId,
    updatedAt: now,
    updatedBy: userId,
  };

  const [article] = existing
    ? await db.update(articles).set(values).where(eq(articles.id, existing.id)).returning()
    : await db.insert(articles).values(values).returning();
  if (article.status === "published") await linkPublishedArticle(db, article);
  return { ok: true, article };
}

export async function publishArticle(db, id, { expectedUpdatedAt }, { userId, now = new Date().toISOString() }) {
  const existing = await getArticle(db, id);
  if (!existing) return { ok: false, errors: ["Article not found"] };
  if (expectedUpdatedAt !== existing.updatedAt) return { ok: false, errors: [STALE] };
  const problems = publishProblems(existing);
  if (problems.length) return { ok: false, errors: problems };

  const [article] = await db
    .update(articles)
    .set({ status: "published", publishedAt: existing.publishedAt ?? now, updatedAt: now, updatedBy: userId })
    .where(eq(articles.id, existing.id))
    .returning();
  await linkPublishedArticle(db, article);
  return { ok: true, article };
}

export async function unpublishArticle(db, id, { userId, now = new Date().toISOString() }) {
  const [article] = await db
    .update(articles)
    .set({ status: "draft", updatedAt: now, updatedBy: userId })
    .where(eq(articles.id, Number(id)))
    .returning();
  if (!article) return { ok: false, errors: ["Article not found"] };
  await unlinkArticle(db, article.id);
  return { ok: true, article };
}

const publicFields = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  metaDescription: articles.metaDescription,
  category: articles.category,
  bodyHtml: articles.bodyHtml,
  coverUrl: articles.coverUrl,
  coverAlt: articles.coverAlt,
  projectId: articles.projectId,
  publishedAt: articles.publishedAt,
  updatedAt: articles.updatedAt,
  authorName: members.name,
};

function publishedQuery(db) {
  return db
    .select(publicFields)
    .from(articles)
    .leftJoin(members, eq(articles.authorId, members.id))
    .orderBy(desc(articles.publishedAt), desc(articles.id));
}

export function listPublishedArticles(db, { category, limit } = {}) {
  const cond = category
    ? and(eq(articles.status, "published"), eq(articles.category, category))
    : eq(articles.status, "published");
  const q = publishedQuery(db).where(cond);
  return limit ? q.limit(limit) : q;
}

export async function getPublishedArticle(db, slug) {
  const [row] = await publishedQuery(db).where(and(eq(articles.status, "published"), eq(articles.slug, slug)));
  return row ?? null;
}

export function relatedArticles(db, article, limit = 3) {
  return publishedQuery(db)
    .where(and(eq(articles.status, "published"), eq(articles.category, article.category), ne(articles.id, article.id)))
    .limit(limit);
}

export function listArticlesForProject(db, projectId) {
  return publishedQuery(db).where(and(eq(articles.status, "published"), eq(articles.projectId, projectId)));
}

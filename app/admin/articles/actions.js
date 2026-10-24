"use server";

import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForArticle, revalidateAll } from "@/lib/revalidate.js";
import { saveArticle, publishArticle, unpublishArticle } from "@/lib/content/articles.js";
import { logEvent } from "@/lib/evidence.js";
import { audit } from "@/lib/audit.js";

export async function saveArticleAction(input) {
  const { userId } = await requireArea("content");
  const r = await saveArticle(getDb(), input, { userId });
  if (r.ok && r.article.status === "published") revalidateAll(pathsForArticle(r.article.slug));
  if (r.ok) await audit(getDb(), { actor: userId, action: input?.id ? "article.update" : "article.create", table: "articles", id: r.article.id, summary: `${input?.id ? "Edited" : "Created"} article "${r.article.title}"` });
  return r;
}

export async function publishArticleAction(id, expectedUpdatedAt) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await publishArticle(db, id, { expectedUpdatedAt }, { userId });
  if (r.ok) {
    await logEvent(db, { type: "article_published", actor: userId, refTable: "articles", refId: r.article.id });
    await audit(db, { actor: userId, action: "article.publish", table: "articles", id: r.article.id, summary: `Published article "${r.article.title}"` });
    revalidateAll(pathsForArticle(r.article.slug));
  }
  return r;
}

export async function unpublishArticleAction(id) {
  const { userId } = await requireArea("content");
  const r = await unpublishArticle(getDb(), id, { userId });
  if (r.ok) {
    revalidateAll(pathsForArticle(r.article.slug));
    await audit(getDb(), { actor: userId, action: "article.unpublish", table: "articles", id: r.article.id, summary: `Unpublished article "${r.article.title}"` });
  }
  return r;
}

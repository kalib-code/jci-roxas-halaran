import { STATIC_ROUTES } from "@/lib/routes.js";
import { buildSitemap } from "@/lib/seo.js";
import { getDb } from "@/lib/db.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { listProjects } from "@/lib/queries.js";

export const revalidate = 3600;

export default async function sitemap() {
  const db = getDb();
  const [articles, projects] = await Promise.all([listPublishedArticles(db), listProjects(db)]);
  return buildSitemap({ routes: STATIC_ROUTES, articles, projects });
}

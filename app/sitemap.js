import { STATIC_ROUTES } from "@/lib/routes.js";
import { buildSitemap } from "@/lib/seo.js";
import { getDb } from "@/lib/db.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { listProjects } from "@/lib/queries.js";
import { listEvents } from "@/lib/engagement/events.js";
import { hilEnabled, HIL_PATHS } from "@/lib/i18n.js";

export const revalidate = 3600;

export default async function sitemap() {
  const db = getDb();
  const [articles, projects, { upcoming, past }] = await Promise.all([listPublishedArticles(db), listProjects(db), listEvents(db)]);
  const routes = hilEnabled() ? [...STATIC_ROUTES, ...Object.values(HIL_PATHS)] : STATIC_ROUTES;
  return buildSitemap({ routes, articles, projects, events: [...upcoming, ...past] });
}

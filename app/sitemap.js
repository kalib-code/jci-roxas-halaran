import { STATIC_ROUTES } from "@/lib/routes.js";
import { buildSitemap } from "@/lib/seo.js";

export default function sitemap() {
  return buildSitemap(STATIC_ROUTES);
}

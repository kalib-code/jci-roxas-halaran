import { revalidatePath } from "next/cache";

export const pathsForArticle = (slug) => ["/articles", `/articles/${slug}`, "/", "/sitemap.xml"];
export const pathsForProject = (slug) => ["/projects", `/projects/${slug}`, "/", "/sitemap.xml"];
export const RESOURCE_PATHS = ["/resources"];

export function revalidateAll(paths) {
  for (const p of paths) revalidatePath(p);
}

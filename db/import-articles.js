import { and, eq, sql } from "drizzle-orm";
import { articles, projects, seoPlan } from "./schema.js";
import { cleanHtml } from "../lib/sanitize.js";

const FIELDS = new Set(["title", "slug", "metaDescription", "targetKeyword", "category", "project", "coverUrl", "coverAlt"]);

// An article file is a "---" block of `key: value` lines followed by the HTML body.
export function parseArticleFile(text) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text.replace(/\r\n/g, "\n"));
  if (!match) throw new Error("Article file must start with a --- header block");
  const meta = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    const key = line.slice(0, i).trim();
    if (i < 0 || !FIELDS.has(key)) throw new Error(`Unknown header line "${line}"`);
    meta[key] = line.slice(i + 1).trim();
  }
  for (const key of ["title", "slug", "metaDescription", "targetKeyword", "category"]) {
    if (!meta[key]) throw new Error(`Missing "${key}" in header`);
  }
  return { ...meta, bodyHtml: match[2].trim() };
}

// Adds each article as a draft. Slugs that already exist are skipped, so
// re-running never overwrites edits made in the admin. The matching SEO plan
// row moves from "idea" to "drafting"; publishing in the admin does the rest.
export async function importArticles(db, parsed, { now = new Date().toISOString() } = {}) {
  const projectIds = new Map(
    (await db.select({ id: projects.id, slug: projects.slug }).from(projects)).map((p) => [p.slug, p.id]),
  );
  const result = { added: [], skipped: [] };

  for (const a of parsed) {
    const [taken] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, a.slug));
    if (taken) {
      result.skipped.push(a.slug);
      continue;
    }
    if (a.project && !projectIds.has(a.project)) throw new Error(`${a.slug}: unknown project "${a.project}"`);

    const [row] = await db
      .insert(articles)
      .values({
        slug: a.slug,
        title: a.title,
        metaDescription: a.metaDescription,
        targetKeyword: a.targetKeyword,
        category: a.category,
        bodyHtml: cleanHtml(a.bodyHtml),
        coverUrl: a.coverUrl || null,
        coverAlt: a.coverAlt || null,
        projectId: a.project ? projectIds.get(a.project) : null,
        status: "draft",
        updatedAt: now,
        updatedBy: "import",
      })
      .returning();
    await db
      .update(seoPlan)
      .set({ status: "drafting", articleId: row.id })
      .where(and(sql`lower(${seoPlan.keyword}) = lower(${a.targetKeyword})`, eq(seoPlan.status, "idea")));
    result.added.push(a.slug);
  }
  return result;
}

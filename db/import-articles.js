import { and, eq, sql } from "drizzle-orm";
import { articles, projects, seoPlan } from "./schema.js";
import { cleanHtml } from "../lib/sanitize.js";

const FIELDS = ["title", "slug", "metaDescription", "targetKeyword", "category", "project", "coverUrl", "coverAlt"];
const REQUIRED = ["title", "slug", "metaDescription", "targetKeyword", "category"];

// A content file is a "---" block of `key: value` lines followed by the HTML body.
// Keys listed in `repeatable` may appear on several lines and come back as arrays.
export function parseFrontMatter(text, fields, required, repeatable = []) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text.replace(/\r\n/g, "\n"));
  if (!match) throw new Error("File must start with a --- header block");
  const meta = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    const key = line.slice(0, i).trim();
    if (i < 0 || !fields.includes(key)) throw new Error(`Unknown header line "${line}"`);
    const value = line.slice(i + 1).trim();
    if (repeatable.includes(key)) (meta[key] ??= []).push(value);
    else meta[key] = value;
  }
  for (const key of required) {
    if (!meta[key]) throw new Error(`Missing "${key}" in header`);
  }
  return { ...meta, bodyHtml: match[2].trim() };
}

export const parseArticleFile = (text) => parseFrontMatter(text, FIELDS, REQUIRED);

// Adds each article as a draft. A draft nobody has saved since the import is
// refreshed from its file; anything an officer has touched (or published) is
// skipped, so re-running never overwrites edits made in the admin. The matching
// SEO plan row moves from "idea" to "drafting"; publishing in the admin does the rest.
export async function importArticles(db, parsed, { now = new Date().toISOString() } = {}) {
  const projectIds = new Map(
    (await db.select({ id: projects.id, slug: projects.slug }).from(projects)).map((p) => [p.slug, p.id]),
  );
  const result = { added: [], refreshed: [], skipped: [] };

  for (const a of parsed) {
    if (a.project && !projectIds.has(a.project)) throw new Error(`${a.slug}: unknown project "${a.project}"`);
    const values = {
      title: a.title,
      metaDescription: a.metaDescription,
      targetKeyword: a.targetKeyword,
      category: a.category,
      bodyHtml: cleanHtml(a.bodyHtml),
      coverUrl: a.coverUrl || null,
      coverAlt: a.coverAlt || null,
      projectId: a.project ? projectIds.get(a.project) : null,
      updatedAt: now,
      updatedBy: "import",
    };

    const [taken] = await db.select().from(articles).where(eq(articles.slug, a.slug));
    if (taken) {
      if (taken.status === "draft" && taken.updatedBy === "import") {
        await db.update(articles).set(values).where(eq(articles.id, taken.id));
        result.refreshed.push(a.slug);
      } else {
        result.skipped.push(a.slug);
      }
      continue;
    }

    const [row] = await db.insert(articles).values({ slug: a.slug, status: "draft", ...values }).returning();
    await db
      .update(seoPlan)
      .set({ status: "drafting", articleId: row.id })
      .where(and(sql`lower(${seoPlan.keyword}) = lower(${a.targetKeyword})`, eq(seoPlan.status, "idea")));
    result.added.push(a.slug);
  }
  return result;
}

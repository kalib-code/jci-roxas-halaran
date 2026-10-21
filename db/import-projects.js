import { eq } from "drizzle-orm";
import { projects } from "./schema.js";
import { cleanHtml } from "../lib/sanitize.js";
import { parseFrontMatter } from "./import-articles.js";

const FIELDS = ["title", "slug", "summary", "startDate", "endDate", "barangay", "pillar", "status", "coverUrl", "coverAlt"];
const FILLABLE = ["summary", "body", "startDate", "endDate", "barangay", "coverUrl", "coverAlt"];

export function parseProjectFile(text) {
  const { bodyHtml, ...meta } = parseFrontMatter(text, FIELDS, ["title", "slug", "summary"]);
  for (const key of ["startDate", "endDate"]) {
    if (meta[key] && !/^\d{4}-\d{2}-\d{2}$/.test(meta[key])) throw new Error(`${key} must look like 2026-11-30`);
  }
  if (meta.pillar && !["leadership", "community", "global"].includes(meta.pillar)) throw new Error(`Unknown pillar "${meta.pillar}"`);
  if (meta.status && !["planned", "ongoing", "done"].includes(meta.status)) throw new Error(`Unknown status "${meta.status}"`);
  if (meta.summary.length > 300) throw new Error("summary is over 300 characters");
  return { ...meta, body: bodyHtml };
}

// New slugs are added. For existing projects only empty fields are filled, so
// re-running never overwrites what an officer has written in the admin.
export async function importProjects(db, parsed, { now = new Date().toISOString() } = {}) {
  const result = { added: [], filled: [], unchanged: [] };
  for (const p of parsed) {
    const incoming = { ...p, body: p.body ? cleanHtml(p.body) : "" };
    const [existing] = await db.select().from(projects).where(eq(projects.slug, p.slug));
    if (!existing) {
      await db.insert(projects).values({
        slug: p.slug,
        title: p.title,
        pillar: p.pillar || "community",
        status: p.status || "done",
        ...Object.fromEntries(FILLABLE.map((k) => [k, incoming[k] || null])),
        updatedAt: now,
      });
      result.added.push(p.slug);
      continue;
    }
    const gaps = Object.fromEntries(FILLABLE.filter((k) => !existing[k] && incoming[k]).map((k) => [k, incoming[k]]));
    if (Object.keys(gaps).length === 0) {
      result.unchanged.push(p.slug);
      continue;
    }
    await db.update(projects).set({ ...gaps, updatedAt: now }).where(eq(projects.id, existing.id));
    result.filled.push(`${p.slug} (${Object.keys(gaps).join(", ")})`);
  }
  return result;
}

import { eq } from "drizzle-orm";
import { projects, projectMetrics, projectMedia } from "./schema.js";
import { embedFor } from "../lib/media.js";
import { cleanHtml } from "../lib/sanitize.js";
import { parseCoordinates, inPhilippines } from "../lib/proof/location.js";
import { METRICS } from "../lib/proof/metric-labels.js";
import { parseFrontMatter } from "./import-articles.js";

const FIELDS = ["title", "slug", "summary", "startDate", "endDate", "barangay", "location", "metrics", "media", "pillar", "status", "coverUrl", "coverAlt"];
const FILLABLE = ["summary", "body", "startDate", "endDate", "barangay", "lat", "lng", "coverUrl", "coverAlt"];

// "people_reached=120, meals_served=300" -> [["people_reached", 120], ...]
function parseMetrics(text) {
  return text.split(",").map((pair) => {
    const [name, value] = pair.split("=").map((x) => x.trim());
    if (!(name in METRICS)) throw new Error(`Unknown metric "${name}"`);
    if (!/^\d+$/.test(value ?? "")) throw new Error(`Metric ${name} needs a whole number`);
    return [name, Number(value)];
  });
}

export function parseProjectFile(text) {
  const { bodyHtml, ...meta } = parseFrontMatter(text, FIELDS, ["title", "slug", "summary"], ["media"]);
  for (const key of ["startDate", "endDate"]) {
    if (meta[key] && !/^\d{4}-\d{2}-\d{2}$/.test(meta[key])) throw new Error(`${key} must look like 2026-11-30`);
  }
  if (meta.pillar && !["leadership", "community", "global"].includes(meta.pillar)) throw new Error(`Unknown pillar "${meta.pillar}"`);
  if (meta.status && !["planned", "ongoing", "done"].includes(meta.status)) throw new Error(`Unknown status "${meta.status}"`);
  if (meta.summary.length > 300) throw new Error("summary is over 300 characters");
  // media: <link> | <title>, one line per video or audio
  const media = (meta.media ?? []).map((line) => {
    const [url, title] = line.split("|").map((x) => x.trim());
    if (!embedFor(url)) throw new Error(`media link "${url}" is not a supported player`);
    if (!title) throw new Error(`media link "${url}" needs a title after |`);
    return { url, title };
  });
  const { location, metrics, media: _media, ...rest } = meta;
  const coords = location ? parseCoordinates(location) : null;
  if (location && !(coords && inPhilippines(coords.lat, coords.lng))) throw new Error(`location "${location}" is not a point in the Philippines`);
  return { ...rest, ...(coords ?? {}), metrics: metrics ? parseMetrics(metrics) : [], media, body: bodyHtml };
}

// Adds metrics the project does not have yet; existing values are left alone.
async function addMetrics(db, projectId, metrics) {
  if (!metrics.length) return [];
  await db
    .insert(projectMetrics)
    .values(metrics.map(([metric, value]) => ({ projectId, metric, value })))
    .onConflictDoNothing();
  return metrics.map(([m]) => m);
}

// Adds media links the project does not have yet, after any already there.
async function addMedia(db, projectId, media) {
  if (!media.length) return [];
  const have = await db.select({ url: projectMedia.url, sort: projectMedia.sort }).from(projectMedia).where(eq(projectMedia.projectId, projectId));
  const known = new Set(have.map((m) => m.url));
  const fresh = media.filter((m) => !known.has(m.url));
  const start = have.reduce((n, m) => Math.max(n, m.sort + 1), 0);
  if (fresh.length) await db.insert(projectMedia).values(fresh.map((m, i) => ({ projectId, ...m, sort: start + i })));
  return fresh.length ? ["media"] : [];
}

// New slugs are added. For existing projects only empty fields are filled, so
// re-running never overwrites what an officer has written in the admin.
export async function importProjects(db, parsed, { now = new Date().toISOString() } = {}) {
  const result = { added: [], filled: [], unchanged: [] };
  for (const p of parsed) {
    const incoming = { ...p, body: p.body ? cleanHtml(p.body) : "" };
    const [existing] = await db.select().from(projects).where(eq(projects.slug, p.slug));
    if (!existing) {
      const [row] = await db.insert(projects).values({
        slug: p.slug,
        title: p.title,
        pillar: p.pillar || "community",
        status: p.status || "done",
        ...Object.fromEntries(FILLABLE.map((k) => [k, incoming[k] || null])),
        updatedAt: now,
      }).returning();
      await addMetrics(db, row.id, p.metrics);
      await addMedia(db, row.id, p.media);
      result.added.push(p.slug);
      continue;
    }
    const gaps = Object.fromEntries(FILLABLE.filter((k) => existing[k] == null || existing[k] === "").filter((k) => incoming[k] != null && incoming[k] !== "").map((k) => [k, incoming[k]]));
    const have = new Set((await db.select({ m: projectMetrics.metric }).from(projectMetrics).where(eq(projectMetrics.projectId, existing.id))).map((r) => r.m));
    const newMetrics = await addMetrics(db, existing.id, p.metrics.filter(([m]) => !have.has(m)));
    const newMedia = await addMedia(db, existing.id, p.media);
    if (Object.keys(gaps).length === 0 && newMetrics.length === 0 && newMedia.length === 0) {
      result.unchanged.push(p.slug);
      continue;
    }
    if (Object.keys(gaps).length) await db.update(projects).set({ ...gaps, updatedAt: now }).where(eq(projects.id, existing.id));
    result.filled.push(`${p.slug} (${[...Object.keys(gaps), ...newMetrics, ...newMedia].join(", ")})`);
  }
  return result;
}

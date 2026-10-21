import { asc, eq } from "drizzle-orm";
import { projects, projectPhotos } from "../../db/schema.js";
import { projectInput } from "./validation.js";
import { cleanHtml } from "../sanitize.js";
import { slugify } from "../format.js";

export async function getProject(db, id) {
  const [row] = await db.select().from(projects).where(eq(projects.id, Number(id)));
  return row ?? null;
}

export async function getProjectBySlug(db, slug) {
  const [row] = await db.select().from(projects).where(eq(projects.slug, slug));
  if (!row) return null;
  const photos = await db
    .select()
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, row.id))
    .orderBy(asc(projectPhotos.sort), asc(projectPhotos.id));
  return { ...row, photos };
}

export async function saveProject(db, { id, expectedUpdatedAt, ...raw }, { now = new Date().toISOString() }) {
  const parsed = projectInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const d = parsed.data;

  const existing = id ? await getProject(db, id) : null;
  if (id && !existing) return { ok: false, errors: ["Project not found"] };
  if (existing && (expectedUpdatedAt ?? null) !== (existing.updatedAt ?? null)) {
    return { ok: false, errors: ["This was changed since you opened it — reload"] };
  }

  const slug = existing ? existing.slug : slugify(d.slug || d.title);
  if (!existing) {
    const taken = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, slug));
    if (taken.length) return { ok: false, errors: [`The address /projects/${slug} is taken — try ${slug}-2`] };
  }

  const values = {
    title: d.title,
    slug,
    summary: d.summary || null,
    startDate: d.startDate || null,
    endDate: d.endDate || null,
    barangay: d.barangay || null,
    pillar: d.pillar,
    status: d.status,
    coverUrl: d.coverUrl || null,
    coverAlt: d.coverAlt || null,
    bodyJson: d.bodyJson || null,
    body: cleanHtml(d.bodyHtml),
    lat: d.lat,
    lng: d.lng,
    updatedAt: now,
  };
  if (values.coverUrl && !values.coverAlt) return { ok: false, errors: ["Add alt text for the cover image"] };

  const [project] = existing
    ? await db.update(projects).set(values).where(eq(projects.id, existing.id)).returning()
    : await db.insert(projects).values(values).returning();
  return { ok: true, project };
}

export async function addProjectPhoto(db, { projectId, url, alt, caption = null, kind = "gallery" }) {
  if (!alt?.trim()) return { ok: false, errors: ["Add alt text for the photo"] };
  const [photo] = await db
    .insert(projectPhotos)
    .values({ projectId: Number(projectId), url, alt: alt.trim(), caption, kind })
    .returning();
  return { ok: true, photo };
}

export async function deleteProjectPhoto(db, photoId) {
  const [photo] = await db.delete(projectPhotos).where(eq(projectPhotos.id, Number(photoId))).returning();
  return photo ? { ok: true, photo } : { ok: false, errors: ["Photo not found"] };
}

"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForProject, revalidateAll } from "@/lib/revalidate.js";
import { setProjectMetrics } from "@/lib/proof/metrics.js";
import { saveProject, addProjectPhoto, deleteProjectPhoto, addProjectMedia, deleteProjectMedia, getProject } from "@/lib/content/projects.js";
import { audit } from "@/lib/audit.js";

export async function saveProjectAction(input) {
  const { userId } = await requireArea("content");
  const r = await saveProject(getDb(), input, { userId });
  if (r.ok) {
    revalidateAll(pathsForProject(r.project.slug));
    await audit(getDb(), { actor: userId, action: input?.id ? "project.update" : "project.create", table: "projects", id: r.project.id, summary: `${input?.id ? "Edited" : "Created"} project "${r.project.title}"` });
    revalidatePath("/impact");
  }
  return r;
}

export async function addProjectPhotoAction(input) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await addProjectPhoto(db, input);
  if (r.ok) {
    const project = await getProject(db, input.projectId);
    revalidateAll(pathsForProject(project.slug));
    await audit(db, { actor: userId, action: "project.add_photo", table: "projects", id: project.id, summary: `Added a photo to "${project.title}"` });
  }
  return r;
}

export async function deleteProjectPhotoAction(photoId, slug) {
  const { userId } = await requireArea("content");
  const r = await deleteProjectPhoto(getDb(), photoId);
  if (r.ok) {
    revalidateAll(pathsForProject(slug));
    await audit(getDb(), { actor: userId, action: "project.delete_photo", table: "projects", id: r.photo.projectId, summary: `Deleted a photo from project ${slug}`, details: { url: r.photo.url } });
  }
  return r;
}

export async function addProjectMediaAction(input) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await addProjectMedia(db, input);
  if (r.ok) {
    const project = await getProject(db, input.projectId);
    revalidateAll(pathsForProject(project.slug));
    await audit(db, { actor: userId, action: "project.add_media", table: "projects", id: project.id, summary: `Added a media link to "${project.title}"`, details: { url: r.item.url } });
  }
  return r;
}

export async function deleteProjectMediaAction(mediaId, slug) {
  const { userId } = await requireArea("content");
  const r = await deleteProjectMedia(getDb(), mediaId);
  if (r.ok) {
    revalidateAll(pathsForProject(slug));
    await audit(getDb(), { actor: userId, action: "project.delete_media", table: "projects", id: r.item.projectId, summary: `Deleted a media link from project ${slug}`, details: { url: r.item.url } });
  }
  return r;
}

export async function setProjectMetricsAction(projectId, rows) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await setProjectMetrics(db, projectId, rows);
  if (!r.ok) return r;
  const project = await getProject(db, projectId);
  if (project) revalidateAll(pathsForProject(project.slug));
  revalidatePath("/impact");
  await audit(db, { actor: userId, action: "project.metrics", table: "projects", id: projectId, summary: `Updated impact numbers for "${project?.title ?? `project #${projectId}`}"`, details: r.metrics });
  return { ok: true };
}

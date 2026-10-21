"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForProject, revalidateAll } from "@/lib/revalidate.js";
import { setProjectMetrics } from "@/lib/proof/metrics.js";
import { saveProject, addProjectPhoto, deleteProjectPhoto, addProjectMedia, deleteProjectMedia, getProject } from "@/lib/content/projects.js";

export async function saveProjectAction(input) {
  const { userId } = await requireArea("content");
  const r = await saveProject(getDb(), input, { userId });
  if (r.ok) {
    revalidateAll(pathsForProject(r.project.slug));
    revalidatePath("/impact");
  }
  return r;
}

export async function addProjectPhotoAction(input) {
  await requireArea("content");
  const db = getDb();
  const r = await addProjectPhoto(db, input);
  if (r.ok) revalidateAll(pathsForProject((await getProject(db, input.projectId)).slug));
  return r;
}

export async function deleteProjectPhotoAction(photoId, slug) {
  await requireArea("content");
  const r = await deleteProjectPhoto(getDb(), photoId);
  if (r.ok) revalidateAll(pathsForProject(slug));
  return r;
}

export async function addProjectMediaAction(input) {
  await requireArea("content");
  const db = getDb();
  const r = await addProjectMedia(db, input);
  if (r.ok) revalidateAll(pathsForProject((await getProject(db, input.projectId)).slug));
  return r;
}

export async function deleteProjectMediaAction(mediaId, slug) {
  await requireArea("content");
  const r = await deleteProjectMedia(getDb(), mediaId);
  if (r.ok) revalidateAll(pathsForProject(slug));
  return r;
}

export async function setProjectMetricsAction(projectId, rows) {
  await requireArea("content");
  const db = getDb();
  const r = await setProjectMetrics(db, projectId, rows);
  if (!r.ok) return r;
  const project = await getProject(db, projectId);
  if (project) revalidateAll(pathsForProject(project.slug));
  revalidatePath("/impact");
  return { ok: true };
}

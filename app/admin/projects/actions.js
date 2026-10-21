"use server";

import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForProject, revalidateAll } from "@/lib/revalidate.js";
import { saveProject, addProjectPhoto, deleteProjectPhoto, getProject } from "@/lib/content/projects.js";

export async function saveProjectAction(input) {
  const { userId } = await requireArea("content");
  const r = await saveProject(getDb(), input, { userId });
  if (r.ok) revalidateAll(pathsForProject(r.project.slug));
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

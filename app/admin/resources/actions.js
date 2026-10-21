"use server";

import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { RESOURCE_PATHS, revalidateAll } from "@/lib/revalidate.js";
import { createResource, deleteResource } from "@/lib/content/resources.js";

export async function createResourceAction(input) {
  const { userId } = await requireArea("content");
  const r = await createResource(getDb(), input, { userId });
  if (r.ok) revalidateAll(RESOURCE_PATHS);
  return r;
}

export async function deleteResourceAction(id) {
  await requireArea("content");
  const r = await deleteResource(getDb(), id);
  if (r.ok) revalidateAll(RESOURCE_PATHS);
  return r;
}

"use server";

import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { RESOURCE_PATHS, revalidateAll } from "@/lib/revalidate.js";
import { createResource, deleteResource } from "@/lib/content/resources.js";
import { audit } from "@/lib/audit.js";

export async function createResourceAction(input) {
  const { userId } = await requireArea("content");
  const r = await createResource(getDb(), input, { userId });
  if (r.ok) {
    revalidateAll(RESOURCE_PATHS);
    await audit(getDb(), { actor: userId, action: "resource.create", table: "resources", id: r.resource.id, summary: `Added resource "${r.resource.title}"` });
  }
  return r;
}

export async function deleteResourceAction(id) {
  const { userId } = await requireArea("content");
  const r = await deleteResource(getDb(), id);
  if (r.ok) {
    revalidateAll(RESOURCE_PATHS);
    await audit(getDb(), { actor: userId, action: "resource.delete", table: "resources", id: r.resource.id, summary: `Deleted resource "${r.resource.title}"` });
  }
  return r;
}

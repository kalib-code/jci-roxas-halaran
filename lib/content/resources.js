import { desc, eq } from "drizzle-orm";
import { resources } from "../../db/schema.js";
import { resourceInput } from "./validation.js";

export async function createResource(db, raw, { now = new Date().toISOString() }) {
  const parsed = resourceInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const [resource] = await db
    .insert(resources)
    .values({ ...parsed.data, description: parsed.data.description || null, createdAt: now })
    .returning();
  return { ok: true, resource };
}

export function listResources(db, { visibility } = {}) {
  const q = db.select().from(resources).orderBy(desc(resources.createdAt), desc(resources.id));
  return visibility ? q.where(eq(resources.visibility, visibility)) : q;
}

export async function deleteResource(db, id) {
  const [resource] = await db.delete(resources).where(eq(resources.id, Number(id))).returning();
  return resource ? { ok: true, resource } : { ok: false, errors: ["Resource not found"] };
}

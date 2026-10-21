"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { upsertSnapshot } from "@/lib/proof/evidence.js";

export async function saveSnapshotAction(input) {
  const { userId } = await requireArea("content");
  const r = await upsertSnapshot(getDb(), input, { userId });
  if (!r.ok) return r;
  revalidatePath("/admin/evidence");
  return { ok: true };
}

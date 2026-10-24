"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { upsertSnapshot } from "@/lib/proof/evidence.js";
import { audit } from "@/lib/audit.js";

export async function saveSnapshotAction(input) {
  const { userId } = await requireArea("content");
  const r = await upsertSnapshot(getDb(), input, { userId });
  if (!r.ok) return r;
  revalidatePath("/admin/evidence");
  await audit(getDb(), { actor: userId, action: "analytics.save", table: "analytics_snapshots", id: r.snapshot?.id, summary: `Saved analytics snapshot${r.snapshot?.month ? ` for ${r.snapshot.month}` : ""}` });
  return { ok: true };
}

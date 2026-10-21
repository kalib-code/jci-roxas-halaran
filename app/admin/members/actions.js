"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { adminUpdateMember } from "@/lib/members/profile.js";
import { verifyEntry, declineEntry, addVerifiedEntry } from "@/lib/members/passport.js";

export async function updateMemberAction(id, input) {
  await requireArea("content");
  const r = await adminUpdateMember(getDb(), id, input);
  if (r.ok) {
    revalidatePath("/admin/members");
    revalidatePath("/members/directory");
  }
  return r.ok ? { ok: true } : r;
}

export async function verifyEntryAction(id, points) {
  const { userId } = await requireArea("content");
  const r = await verifyEntry(getDb(), id, { userId, points: points === "" || points == null ? undefined : Number(points) });
  revalidatePath("/admin/passport");
  return r.ok ? { ok: true } : r;
}

export async function declineEntryAction(id) {
  const { userId } = await requireArea("content");
  const r = await declineEntry(getDb(), id, { userId });
  revalidatePath("/admin/passport");
  return r.ok ? { ok: true } : r;
}

export async function addEntryAction(memberId, input) {
  const { userId } = await requireArea("content");
  const points = input?.points === "" || input?.points == null ? undefined : Number(input.points);
  const r = await addVerifiedEntry(getDb(), memberId, input, { userId, points });
  revalidatePath("/admin/passport");
  return r.ok ? { ok: true } : r;
}

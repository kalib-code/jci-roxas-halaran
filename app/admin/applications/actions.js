"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { inviteMember } from "@/lib/clerk-invite.js";
import { approveApplication, declineApplication } from "@/lib/engagement/applications.js";

export async function approveApplicationAction(id) {
  const { userId } = await requireArea("content");
  const r = await approveApplication(getDb(), id, { userId, invite: inviteMember });
  revalidatePath("/admin/applications");
  if (!r.ok) return r;
  return { ok: true, invited: r.invited, linkedAccount: r.linkedAccount, inviteError: r.inviteError, memberName: r.member.name };
}

export async function declineApplicationAction(id, note) {
  const { userId } = await requireArea("content");
  const r = await declineApplication(getDb(), id, { userId, note });
  revalidatePath("/admin/applications");
  return r;
}

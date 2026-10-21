"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { SITE } from "@/lib/site.js";
import { approveApplication, declineApplication } from "@/lib/engagement/applications.js";

async function inviteMember(email) {
  const clerk = await clerkClient();
  await clerk.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: { role: "member" },
    redirectUrl: `${SITE.url}/sign-in`,
    ignoreExisting: true,
  });
}

export async function approveApplicationAction(id) {
  const { userId } = await requireArea("content");
  const r = await approveApplication(getDb(), id, { userId, invite: inviteMember });
  revalidatePath("/admin/applications");
  if (!r.ok) return r;
  return { ok: true, invited: r.invited, inviteError: r.inviteError, memberName: r.member.name };
}

export async function declineApplicationAction(id, note) {
  const { userId } = await requireArea("content");
  const r = await declineApplication(getDb(), id, { userId, note });
  revalidatePath("/admin/applications");
  return r;
}

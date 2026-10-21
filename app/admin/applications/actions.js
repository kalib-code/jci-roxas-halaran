"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { SITE } from "@/lib/site.js";
import { approveApplication, declineApplication } from "@/lib/engagement/applications.js";

// Existing Clerk accounts get the member role (never replacing a higher one);
// everyone else gets an invitation that carries the role.
async function inviteMember(email) {
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({ emailAddress: [email] });
  const existing = data?.[0];
  if (existing) {
    if (!existing.publicMetadata?.role) {
      await clerk.users.updateUserMetadata(existing.id, { publicMetadata: { role: "member" } });
    }
    return { clerkUserId: existing.id, invited: false };
  }
  await clerk.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: { role: "member" },
    redirectUrl: `${SITE.url}/sign-in`,
    ignoreExisting: true,
  });
  return { invited: true };
}

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

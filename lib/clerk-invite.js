import { clerkClient } from "@clerk/nextjs/server";
import { SITE } from "./site.js";

// Existing Clerk accounts get the member role (never replacing a higher one);
// everyone else gets an invitation that carries the role.
export async function inviteMember(email) {
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

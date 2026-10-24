import { clerkClient } from "@clerk/nextjs/server";
import { SITE } from "./site.js";

// An account counts only when it has proven it owns the address; anyone else
// gets an invitation, which Clerk redeems only from that inbox.
export const ownsEmail = (user, email) =>
  (user?.emailAddresses ?? []).some(
    (e) => e.emailAddress?.toLowerCase() === email.toLowerCase() && e.verification?.status === "verified",
  );

// Existing Clerk accounts get the member role (never replacing a higher one);
// everyone else gets an invitation that carries the role.
export async function inviteMember(email) {
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({ emailAddress: [email] });
  const existing = data?.find((u) => ownsEmail(u, email));
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

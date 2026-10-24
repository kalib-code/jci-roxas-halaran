import { clerkClient } from "@clerk/nextjs/server";
import { SITE } from "./site.js";

// An account counts only when it has proven it owns the address; anyone else
// gets an invitation, which Clerk redeems only from that inbox.
export const ownsEmail = (user, email) =>
  (user?.emailAddresses ?? []).some(
    (e) => e.emailAddress?.toLowerCase() === email.toLowerCase() && e.verification?.status === "verified",
  );

const RANK = { member: 0, officer: 1, treasurer: 1, admin: 2 };
// Raise a role, never lower one (a manually made admin stays admin).
export const shouldRaise = (current, target) => (RANK[current] ?? -1) < (RANK[target] ?? 0);

// Existing Clerk accounts get the role (only ever raised); everyone else gets
// an invitation that carries it. Board members are invited as "admin".
export async function inviteMember(email, { role = "member" } = {}) {
  const clerk = await clerkClient();
  const { data } = await clerk.users.getUserList({ emailAddress: [email] });
  const existing = data?.find((u) => ownsEmail(u, email));
  if (existing) {
    if (shouldRaise(existing.publicMetadata?.role, role)) {
      await clerk.users.updateUserMetadata(existing.id, { publicMetadata: { role } });
    }
    return { clerkUserId: existing.id, invited: false };
  }
  await clerk.invitations.createInvitation({
    emailAddress: email,
    publicMetadata: { role },
    redirectUrl: `${SITE.url}/sign-in`,
    ignoreExisting: true,
  });
  return { invited: true };
}

// For accounts already linked to a member: raise their role if it's lower.
export async function raiseRole(clerkUserId, role) {
  const clerk = await clerkClient();
  const user = await clerk.users.getUser(clerkUserId);
  if (!shouldRaise(user.publicMetadata?.role, role)) return false;
  await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: { role } });
  return true;
}

import { normalizeRole } from "../roles.js";
import { loadClerkUser, verifiedEmail } from "../clerk-user.js";
import { raiseRole } from "../clerk-invite.js";
import { audit } from "../audit.js";
import { memberForUser } from "./link.js";
import { isAdminBoardMember } from "./board.js";

// A first sign-in that arrived without a role (they registered from Member login
// instead of the invitation link, or Clerk didn't carry the invitation's role):
// a verified email that matches a member record gets member access, or admin for
// an officer, so nobody lands on "Not found".
export async function claimMembership(db, userId, { loadUser = loadClerkUser, raise = raiseRole } = {}) {
  const user = await loadUser(userId);
  if (normalizeRole(user?.publicMetadata?.role)) return { ok: true, already: true };
  const email = verifiedEmail(user);
  if (!email) return { ok: false, reason: "unverified" };
  const member = await memberForUser(db, { clerkUserId: userId, email });
  if (!member) return { ok: false, reason: "no-member", email };
  const role = (await isAdminBoardMember(db, member.id)) ? "admin" : "member";
  await raise(userId, role);
  await audit(db, { actor: "system", action: "member.claim", table: "members", id: member.id, summary: `Linked ${member.name}'s first sign-in and gave ${role} access` });
  return { ok: true, role, member };
}

import { requireArea } from "../auth.js";
import { getDb } from "../db.js";
import { loadClerkUser } from "../clerk-user.js";
import { memberForUser } from "./link.js";
import { isAdminBoardMember } from "./board.js";
import { raiseRole } from "../clerk-invite.js";
import { audit } from "../audit.js";

// The address that links a sign-in to a member record: one Clerk has verified.
const verifiedEmail = (user) => {
  const ok = (e) => e?.verification?.status === "verified";
  if (ok(user?.primaryEmailAddress)) return user.primaryEmailAddress.emailAddress;
  return user?.emailAddresses?.find(ok)?.emailAddress ?? null;
};

// The signed-in user's member record (linked on first sign-in by email).
export async function currentMember() {
  const { userId, role } = await requireArea("members");
  let email = null;
  try {
    const user = await loadClerkUser(userId);
    email = verifiedEmail(user);
  } catch {
    email = null;
  }
  const member = await memberForUser(getDb(), { clerkUserId: userId, email });
  // Officers (this year's board or one elected for a later year) are admins.
  // Their invitations may say "member", so raise them when they first come in.
  if (member && role !== "admin" && (await isAdminBoardMember(getDb(), member.id))) {
    try {
      await raiseRole(userId, "admin");
      await audit(getDb(), { actor: "system", action: "member.auto_admin", table: "members", id: member.id, summary: `Gave ${member.name} admin access as an officer, on first sign-in` });
      return { userId, role: "admin", member };
    } catch (e) {
      console.error("Couldn't give an officer admin access", e?.message);
    }
  }
  return { userId, role, member };
}

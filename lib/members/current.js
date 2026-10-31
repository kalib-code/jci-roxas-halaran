import { requireArea } from "../auth.js";
import { getDb } from "../db.js";
import { loadClerkUser } from "../clerk-user.js";
import { memberForUser } from "./link.js";
import { isAdminBoardMember } from "./board.js";
import { raiseRole } from "../clerk-invite.js";

// The signed-in user's member record (linked on first sign-in by email).
export async function currentMember() {
  const { userId, role } = await requireArea("members");
  let email = null;
  try {
    const user = await loadClerkUser(userId);
    email = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? null;
  } catch {
    email = null;
  }
  const member = await memberForUser(getDb(), { clerkUserId: userId, email });
  // Officers (this year's board or one elected for a later year) are admins.
  // Their invitations may say "member", so raise them when they first come in.
  if (member && role !== "admin" && (await isAdminBoardMember(getDb(), member.id))) {
    try {
      await raiseRole(userId, "admin");
      return { userId, role: "admin", member };
    } catch (e) {
      console.error("Couldn't give an officer admin access", e?.message);
    }
  }
  return { userId, role, member };
}

import { requireArea } from "../auth.js";
import { getDb } from "../db.js";
import { loadClerkUser } from "../clerk-user.js";
import { memberForUser } from "./link.js";

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
  return { userId, role, member: await memberForUser(getDb(), { clerkUserId: userId, email }) };
}

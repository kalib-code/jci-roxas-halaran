import { clerkClient } from "@clerk/nextjs/server";

// The address that links a sign-in to a member record: one Clerk has verified.
export function verifiedEmail(user) {
  const ok = (e) => e?.verification?.status === "verified";
  if (ok(user?.primaryEmailAddress)) return user.primaryEmailAddress.emailAddress;
  return user?.emailAddresses?.find(ok)?.emailAddress ?? null;
}

export async function loadClerkUser(userId) {
  return (await clerkClient()).users.getUser(userId);
}

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { canAccess } from "./roles.js";
import { resolveRole } from "./role-lookup.js";
import { loadClerkUser } from "./clerk-user.js";

// Server-side gate for pages and server actions (spec §4: every write re-checks the role).
export async function requireArea(area) {
  const { userId, sessionClaims } = await auth();
  const role = await resolveRole({ userId, sessionClaims }, loadClerkUser);
  if (!userId || !canAccess(role, area)) notFound();
  return { userId, role };
}

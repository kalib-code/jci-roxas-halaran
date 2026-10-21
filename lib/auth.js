import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { canAccess, roleFromSessionClaims } from "./roles.js";

// Server-side gate for pages and server actions (spec §4: every write re-checks the role).
export async function requireArea(area) {
  const { userId, sessionClaims } = await auth();
  const role = roleFromSessionClaims(sessionClaims);
  if (!userId || !canAccess(role, area)) notFound();
  return { userId, role };
}

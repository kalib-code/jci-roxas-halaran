import { clerkClient } from "@clerk/nextjs/server";

export async function loadClerkUser(userId) {
  return (await clerkClient()).users.getUser(userId);
}

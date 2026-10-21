import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { canAccess, roleFromSessionClaims } from "@/lib/roles.js";

// Second gate behind middleware.js: the admin area never renders for
// someone without an admin-area role, even if middleware is bypassed.
export default async function AdminLayout({ children }) {
  const { sessionClaims } = await auth();
  if (!canAccess(roleFromSessionClaims(sessionClaims), "admin")) notFound();
  return <ClerkProvider>{children}</ClerkProvider>;
}

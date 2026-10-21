import { ClerkProvider } from "@clerk/nextjs";
import { requireArea } from "@/lib/auth.js";

// Second gate behind middleware.js: the admin area never renders for
// someone without an admin-area role, even if middleware is bypassed.
export default async function AdminLayout({ children }) {
  await requireArea("admin");
  return <ClerkProvider>{children}</ClerkProvider>;
}

import { auth } from "@clerk/nextjs/server";
import { normalizeRole } from "@/lib/roles.js";

export const metadata = { title: "Admin", robots: { index: false } };

export default async function Admin() {
  const { sessionClaims } = await auth();
  const role = normalizeRole(sessionClaims?.metadata?.role);
  return (
    <header className="page-hero">
      <h1>Admin</h1>
      <p>Signed in as <strong>{role}</strong>. Content tools for articles, projects and the SEO plan arrive in Phase 2.</p>
    </header>
  );
}

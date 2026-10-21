import { ClerkProvider } from "@clerk/nextjs";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { adminNav } from "@/lib/admin/nav.js";
import { safeAdminCounts } from "@/lib/admin/counts.js";
import AdminSidebar from "@/components/admin/AdminSidebar.jsx";

// Second gate behind middleware.js: the admin area never renders for
// someone without an admin-area role, even if middleware is bypassed.
export default async function AdminLayout({ children }) {
  const { role } = await requireArea("admin");
  const counts = role === "admin" ? await safeAdminCounts(getDb()) : {};
  return (
    <ClerkProvider>
      <div className="admin-shell">
        <AdminSidebar groups={adminNav(role, counts)} role={role} />
        <div className="admin-main">{children}</div>
      </div>
    </ClerkProvider>
  );
}

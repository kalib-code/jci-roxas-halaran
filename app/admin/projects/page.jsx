import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { formatDate } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";

export const metadata = { title: "Projects — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminProjects() {
  await requireArea("content");
  const list = await listProjects(getDb());
  return (
    <div className="admin">
      <h1>Projects</h1>
      <AdminNav isAdmin />
      <p><Link className="btn" href="/admin/projects/new">New project</Link></p>
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Date</th><th>Story</th></tr></thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td><Link href={`/admin/projects/${p.id}`}>{p.title}</Link></td>
              <td>{formatDate(p.startDate) ?? "—"}</td>
              <td>{p.body ? "Yes" : "Not yet"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { safeHttpsUrl } from "@/lib/safe.js";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listResources } from "@/lib/content/resources.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ResourceForm, { DeleteResourceButton } from "@/components/admin/ResourceForm.jsx";

export const metadata = { title: "Resources — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminResources() {
  await requireArea("content");
  const list = await listResources(getDb());
  return (
    <div className="admin">
      <h1>Resources</h1>
      <AdminNav isAdmin />
      <ResourceForm />
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Kind</th><th>Visibility</th><th></th></tr></thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id}>
              <td>{safeHttpsUrl(r.fileUrl) ? <a href={safeHttpsUrl(r.fileUrl)} target="_blank" rel="noreferrer">{r.title}</a> : r.title}</td>
              <td>{r.kind}</td>
              <td>{r.visibility}</td>
              <td><DeleteResourceButton id={r.id} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

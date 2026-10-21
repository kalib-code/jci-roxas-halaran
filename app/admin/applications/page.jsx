import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listApplications } from "@/lib/engagement/applications.js";
import { formatDate } from "@/lib/format.js";
import ApplicationActions from "@/components/admin/ApplicationActions.jsx";

export const metadata = { title: "Applications — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminApplications() {
  await requireArea("content");
  const list = await listApplications(getDb());
  return (
    <div className="admin">
      <h1>Applications</h1>
      <table className="admin-table">
        <thead><tr><th>Applicant</th><th>Details</th><th>Received</th><th>Status</th></tr></thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id}>
              <td><strong>{a.name}</strong><br />{a.email}{a.phone ? <><br />{a.phone}</> : null}</td>
              <td>Born {a.birthdate}{a.barangay ? `, ${a.barangay}` : ""}{a.whyJoin ? <><br />“{a.whyJoin}”</> : null}{a.referredBy ? <><br />Referred by {a.referredBy}</> : null}</td>
              <td>{formatDate(a.createdAt)}</td>
              <td>{a.status === "pending" ? <ApplicationActions id={a.id} /> : `${a.status}${a.note ? ` — ${a.note}` : ""}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {list.length === 0 && <p>No applications yet.</p>}
    </div>
  );
}

import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listApplications } from "@/lib/engagement/applications.js";
import { formatDate } from "@/lib/format.js";
import { pickTab, statusTabs } from "@/lib/admin/tabs.js";
import ApplicationActions from "@/components/admin/ApplicationActions.jsx";
import AdminTabs from "@/components/admin/AdminTabs.jsx";
import StatusBadge from "@/components/admin/StatusBadge.jsx";

export const metadata = { title: "Applications — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TABS = [["pending", "Pending"], ["approved", "Approved"], ["declined", "Declined"]];
const EMPTY = { pending: "No applications waiting — all caught up.", approved: "No approved applications yet.", declined: "No declined applications." };

export default async function AdminApplications({ searchParams }) {
  await requireArea("content");
  const [list, { tab: asked }] = await Promise.all([listApplications(getDb()), searchParams]);
  const tabs = statusTabs(list, TABS);
  const tab = pickTab(asked, tabs.map((t) => t.key));
  const rows = tabs.find((t) => t.key === tab).rows;
  return (
    <div className="admin">
      <h1>Applications</h1>
      <AdminTabs base="/admin/applications" tabs={tabs} current={tab} />
      {rows.length === 0 ? <p className="admin-empty">{EMPTY[tab]}</p> : (
        <table className="admin-table">
          <thead><tr><th>Applicant</th><th>Details</th><th>Received</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td><strong>{a.name}</strong><br />{a.email}{a.phone ? <><br />{a.phone}</> : null}</td>
                <td>Born {a.birthdate}{a.barangay ? `, ${a.barangay}` : ""}{a.whyJoin ? <><br />“{a.whyJoin}”</> : null}{a.referredBy ? <><br />Referred by {a.referredBy}</> : null}</td>
                <td>{formatDate(a.createdAt)}</td>
                <td>{a.status === "pending" ? <ApplicationActions id={a.id} /> : <><StatusBadge status={a.status} />{a.note ? <><br />{a.note}</> : null}</>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

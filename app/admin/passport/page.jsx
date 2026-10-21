import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listRequestedEntries, KIND_LABELS } from "@/lib/members/passport.js";
import { listMembersAdmin } from "@/lib/members/profile.js";
import { formatDate } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import PassportReview from "@/components/admin/PassportReview.jsx";
import AddEntryForm from "@/components/admin/AddEntryForm.jsx";

export const metadata = { title: "Passport — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminPassport() {
  await requireArea("content");
  const db = getDb();
  const [requests, members] = await Promise.all([listRequestedEntries(db), listMembersAdmin(db)]);
  return (
    <div className="admin">
      <h1>Leadership Passport</h1>
      <AdminNav isAdmin />
      <h2 className="syne">Requests ({requests.length})</h2>
      {requests.length === 0 ? <p>No requests waiting.</p> : (
        <table className="admin-table">
          <thead><tr><th>Member</th><th>Entry</th><th>Date</th><th>Review</th></tr></thead>
          <tbody>
            {requests.map((e) => (
              <tr key={e.id}>
                <td>{e.memberName}</td>
                <td>{KIND_LABELS[e.kind]}: {e.title}{e.note ? <><br /><span className="count">{e.note}</span></> : null}</td>
                <td>{formatDate(e.date)}</td>
                <td><PassportReview entry={e} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <AddEntryForm members={members.map((m) => ({ id: m.id, name: m.name }))} />
    </div>
  );
}

import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listPayments, listCampaigns } from "@/lib/engagement/money.js";
import { formatDate, formatPesos } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import PaymentActions from "@/components/admin/PaymentActions.jsx";

export const metadata = { title: "Payments — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TYPE = { donation: "Donation", sponsorship: "Sponsorship", membership_fee: "Membership fee" };

export default async function AdminPayments() {
  await requireArea("content");
  const db = getDb();
  const [list, campaigns] = await Promise.all([listPayments(db), listCampaigns(db)]);
  const campaignName = (id) => campaigns.find((c) => c.id === id)?.title ?? "General";
  const table = (rows, actions) => (
    <table className="admin-table">
      <thead><tr><th>Payer</th><th>Amount</th><th>For</th><th>Reference</th><th>Date</th><th>{actions ? "Review" : "Status"}</th></tr></thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id}>
            <td>{p.payerName}<br />{p.payerEmail}</td>
            <td>{formatPesos(p.amountCentavos)}</td>
            <td>{TYPE[p.type]}{p.type === "donation" ? `: ${campaignName(p.campaignId)}` : ""}</td>
            <td>{p.method.toUpperCase()} {p.referenceNo}{p.proofUrl ? <><br /><a href={p.proofUrl} target="_blank" rel="noreferrer">Screenshot</a></> : null}</td>
            <td>{formatDate(p.createdAt)}</td>
            <td>{actions ? <PaymentActions id={p.id} /> : `${p.status}${p.note ? ` — ${p.note}` : ""}`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const pending = list.filter((p) => p.status === "pending");
  return (
    <div className="admin">
      <h1>Payments</h1>
      <AdminNav isAdmin />
      <p>Check each reference number in the GCash, Maya or bank app before confirming. Only confirmed payments count toward campaign goals.</p>
      <h2 className="syne">To confirm ({pending.length})</h2>
      {pending.length ? table(pending, true) : <p>Nothing to confirm.</p>}
      <h2 className="syne">Reviewed</h2>
      {table(list.filter((p) => p.status !== "pending"), false)}
    </div>
  );
}

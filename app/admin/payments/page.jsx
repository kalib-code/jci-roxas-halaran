import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listPayments, listCampaigns } from "@/lib/engagement/money.js";
import { formatDate, formatPesos } from "@/lib/format.js";
import { safeHttpsUrl } from "@/lib/safe.js";
import { pickTab, statusTabs } from "@/lib/admin/tabs.js";
import PaymentActions from "@/components/admin/PaymentActions.jsx";
import AdminTabs from "@/components/admin/AdminTabs.jsx";
import StatusBadge from "@/components/admin/StatusBadge.jsx";

export const metadata = { title: "Payments — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const TYPE = { donation: "Donation", sponsorship: "Sponsorship", membership_fee: "Membership fee" };
const TABS = [["pending", "To confirm"], ["confirmed", "Confirmed"], ["rejected", "Rejected"]];
const EMPTY = { pending: "Nothing to confirm — all caught up.", confirmed: "No confirmed payments yet.", rejected: "No rejected payments." };

export default async function AdminPayments({ searchParams }) {
  await requireArea("content");
  const db = getDb();
  const [list, campaigns, { tab: asked }] = await Promise.all([listPayments(db), listCampaigns(db), searchParams]);
  const tabs = statusTabs(list, TABS, { amount: true });
  const tab = pickTab(asked, tabs.map((t) => t.key));
  const rows = tabs.find((t) => t.key === tab).rows;
  const campaignName = (id) => campaigns.find((c) => c.id === id)?.title ?? "General";
  return (
    <div className="admin">
      <h1>Payments</h1>
      <p>Check each reference number in the GCash, Maya or bank app before confirming. Only confirmed payments count toward campaign goals.</p>
      <AdminTabs base="/admin/payments" tabs={tabs} current={tab} />
      {rows.length === 0 ? <p className="admin-empty">{EMPTY[tab]}</p> : (
        <table className="admin-table">
          <thead><tr><th>Payer</th><th>Amount</th><th>For</th><th>Reference</th><th>Date</th><th>{tab === "pending" ? "Review" : "Status"}</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.payerName}<br />{p.payerEmail}</td>
                <td>{formatPesos(p.amountCentavos)}</td>
                <td>{TYPE[p.type]}{p.type === "donation" ? `: ${campaignName(p.campaignId)}` : ""}</td>
                <td>{p.method.toUpperCase()} {p.referenceNo}{safeHttpsUrl(p.proofUrl) ? <><br /><a href={safeHttpsUrl(p.proofUrl)} target="_blank" rel="noreferrer">Screenshot</a></> : null}</td>
                <td>{formatDate(p.createdAt)}</td>
                <td>{tab === "pending" ? <PaymentActions id={p.id} /> : <><StatusBadge status={p.status} />{p.note ? <><br />{p.note}</> : null}</>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

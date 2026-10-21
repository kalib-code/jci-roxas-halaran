import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { monthlyEvidence, typeTotals, listSnapshots, CRITERIA, CRITERION_LABELS } from "@/lib/proof/evidence.js";
import { LOG_CRITERIA } from "@/lib/evidence.js";
import { phNow } from "@/lib/format.js";
import SnapshotForm from "@/components/admin/SnapshotForm.jsx";

export const metadata = { title: "Evidence — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Evidence() {
  await requireArea("content");
  const db = getDb();
  const [matrix, types, snapshots] = await Promise.all([monthlyEvidence(db), typeTotals(db), listSnapshots(db)]);
  const thisMonth = phNow().slice(0, 7);
  const snap = new Map(snapshots.map((s) => [s.month, s]));
  return (
    <div className="admin">
      <h1>Bid evidence</h1>
      <p>Every countable action on the site, by Temiong criterion. <a href="/admin/evidence.csv">Download monthly CSV</a> · <a href="/admin/evidence/log.csv">Download every log entry</a></p>
      <table className="admin-table">
        <thead><tr><th>Month</th>{CRITERIA.map((c) => <th key={c}>{CRITERION_LABELS[c]}</th>)}<th>Total</th><th>Organic clicks</th><th>Visitors</th></tr></thead>
        <tbody>
          {matrix.slice().reverse().map((r) => (
            <tr key={r.month}>
              <td>{r.month}</td>
              {CRITERIA.map((c) => <td key={c}>{r[c]}</td>)}
              <td><strong>{r.total}</strong></td>
              <td>{snap.get(r.month)?.organicClicks ?? "—"}</td>
              <td>{snap.get(r.month)?.visitors ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="syne">All time, by action</h2>
      <table className="admin-table">
        <thead><tr><th>Action</th><th>Criterion</th><th>Count</th></tr></thead>
        <tbody>{types.map((t) => <tr key={t.type}><td>{t.type.replace(/_/g, " ")}</td><td>{CRITERION_LABELS[LOG_CRITERIA[t.type]] ?? "—"}</td><td>{t.n}</td></tr>)}</tbody>
      </table>
      <SnapshotForm months={matrix.map((r) => r.month)} month={thisMonth} snapshots={snapshots} />
    </div>
  );
}

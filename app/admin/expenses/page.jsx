import { safeHttpsUrl } from "@/lib/safe.js";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { listCampaigns, listExpenses } from "@/lib/engagement/money.js";
import { formatDate, formatPesos } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ExpenseForm from "@/components/admin/ExpenseForm.jsx";

export const metadata = { title: "Expenses — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminExpenses() {
  await requireArea("content");
  const db = getDb();
  const [expenses, projects, campaigns] = await Promise.all([listExpenses(db), listProjects(db), listCampaigns(db)]);
  const total = expenses.reduce((s, e) => s + e.amountCentavos, 0);
  return (
    <div className="admin">
      <h1>Expenses</h1>
      <AdminNav isAdmin />
      <ExpenseForm projects={projects} campaigns={campaigns} />
      <p>Total recorded: {formatPesos(total)}</p>
      <table className="admin-table">
        <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Receipt</th></tr></thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>{formatDate(e.spentOn)}</td>
              <td>{e.description}</td>
              <td>{formatPesos(e.amountCentavos)}</td>
              <td>{safeHttpsUrl(e.receiptUrl) ? <a href={safeHttpsUrl(e.receiptUrl)} target="_blank" rel="noreferrer">View</a> : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { listCampaigns } from "@/lib/engagement/money.js";
import { formatPesos } from "@/lib/format.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import CampaignForm from "@/components/admin/CampaignForm.jsx";

export const metadata = { title: "Campaigns — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminCampaigns({ searchParams }) {
  await requireArea("content");
  const { id } = await searchParams;
  const db = getDb();
  const [campaigns, projects] = await Promise.all([listCampaigns(db), listProjects(db)]);
  const editing = campaigns.find((c) => String(c.id) === id) ?? null;
  return (
    <div className="admin">
      <h1>Campaigns</h1>
      <AdminNav isAdmin />
      <table className="admin-table">
        <thead><tr><th>Campaign</th><th>Raised</th><th>Goal</th><th>Status</th></tr></thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td><Link href={`/admin/campaigns?id=${c.id}`}>{c.title}</Link></td>
              <td>{formatPesos(c.raisedCentavos)}</td>
              <td>{formatPesos(c.goalCentavos)}</td>
              <td>{c.open ? "Open" : "Closed"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p><Link href="/admin/campaigns">New campaign</Link></p>
      <CampaignForm key={editing?.id ?? "new"} campaign={editing} projects={projects} />
    </div>
  );
}

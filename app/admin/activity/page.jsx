import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listAudit } from "@/lib/audit.js";

export const metadata = { title: "Activity log — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const PER_PAGE = 100;
// Stored in UTC; shown in Philippine time.
const WHEN = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
const show = (v) => (v === null || v === "" ? "(empty)" : String(v));

function Changes({ details }) {
  if (!details || typeof details !== "object") return null;
  const pairs = Object.entries(details).filter(([, v]) => Array.isArray(v) && v.length === 2);
  if (!pairs.length) return null;
  return (
    <ul className="count">
      {pairs.map(([field, [from, to]]) => <li key={field}>{field}: {show(from)} → {show(to)}</li>)}
    </ul>
  );
}

export default async function AdminActivity({ searchParams }) {
  await requireArea("content");
  const page = Math.max(1, Number((await searchParams)?.page) || 1);
  const { rows, total } = await listAudit(getDb(), { limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  return (
    <div className="admin">
      <h1>Activity log</h1>
      <p>Every change made in the admin area, newest first.{total > 0 && <> <a href="/admin/activity.csv">Download CSV</a></>}</p>
      {rows.length === 0 ? <p className="admin-empty">No changes recorded yet.</p> : (
        <table className="admin-table">
          <thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{WHEN.format(new Date(r.createdAt))}</td>
                <td>{r.actorName ?? <span className="count">{r.actorId}</span>}</td>
                <td>{r.summary}<Changes details={r.details} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pages > 1 && (
        <p>
          {page > 1 && <Link href={`/admin/activity?page=${page - 1}`}>← Newer</Link>}
          {" "}Page {page} of {pages}{" "}
          {page < pages && <Link href={`/admin/activity?page=${page + 1}`}>Older →</Link>}
        </p>
      )}
    </div>
  );
}

import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listVolunteers } from "@/lib/engagement/events.js";
import { formatDate } from "@/lib/format.js";

export const metadata = { title: "Volunteers — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const forWhat = (v) =>
  v.projectTitle ? <Link href={`/projects/${v.projectSlug}`}>{v.projectTitle}</Link>
  : v.eventTitle ? <Link href={`/admin/events/${v.eventId}`}>{v.eventTitle}</Link>
  : "Any project";

export default async function AdminVolunteers() {
  await requireArea("content");
  const list = await listVolunteers(getDb());
  return (
    <div className="admin">
      <h1>Volunteers</h1>
      <p>People who signed up on the Support page or a project page.{list.length > 0 && <> <a href="/admin/volunteers.csv">Download CSV</a></>}</p>
      {list.length === 0 ? <p className="admin-empty">No volunteer signups yet.</p> : (
        <table className="admin-table">
          <thead><tr><th>Volunteer</th><th>For</th><th>Skills</th><th>Signed up</th></tr></thead>
          <tbody>
            {list.map((v) => (
              <tr key={v.id}>
                <td><strong>{v.name}</strong><br /><a href={`mailto:${v.email}`}>{v.email}</a>{v.phone ? <><br /><a href={`tel:${v.phone}`}>{v.phone}</a></> : null}</td>
                <td>{forWhat(v)}</td>
                <td>{v.skills ?? "—"}</td>
                <td>{formatDate(v.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

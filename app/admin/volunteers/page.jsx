import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listVolunteers } from "@/lib/engagement/events.js";
import { listDrives, driveIsOpen } from "@/lib/engagement/volunteers.js";
import { formatDate, formatDateTime } from "@/lib/format.js";

export const metadata = { title: "Volunteers — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const forWhat = (v) =>
  v.driveTitle ? <Link href={`/admin/volunteers/${v.driveId}`}>{v.driveTitle}{v.roleLabel ? ` · ${v.roleLabel}` : ""}</Link>
  : v.projectTitle ? <Link href={`/projects/${v.projectSlug}`}>{v.projectTitle}</Link>
  : v.eventTitle ? <Link href={`/admin/events/${v.eventId}`}>{v.eventTitle}</Link>
  : "Any project";

const linkedTo = (d) => d.eventTitle ?? d.projectTitle ?? "—";

export default async function AdminVolunteers() {
  await requireArea("content");
  const db = getDb();
  const [drives, list] = await Promise.all([listDrives(db), listVolunteers(db)]);
  return (
    <div className="admin">
      <h1>Volunteers</h1>

      <section aria-labelledby="drives-h">
        <h2 className="syne" id="drives-h">Volunteer registrations</h2>
        <p>A sign-up page with its own link and QR code, for an event, a project or any activity. Pick roles and how many people each one needs.</p>
        <p><Link className="btn" href="/admin/volunteers/new">New volunteer registration</Link></p>
        {drives.length === 0 ? <p className="admin-empty">No volunteer registrations yet.</p> : (
          <table className="admin-table">
            <thead><tr><th>Registration</th><th>For</th><th>When</th><th>Volunteers</th><th>Status</th></tr></thead>
            <tbody>
              {drives.map((d) => (
                <tr key={d.id}>
                  <td><Link href={`/admin/volunteers/${d.id}`}>{d.title}</Link></td>
                  <td>{linkedTo(d)}</td>
                  <td>{d.startsAt ? formatDateTime(d.startsAt) : "—"}</td>
                  <td>{d.confirmed}{d.spots ? ` / ${d.spots}` : ""}{d.waitlist ? ` (+${d.waitlist} waitlist)` : ""}</td>
                  <td>{driveIsOpen(d) ? <span className="badge badge--ok">Open</span> : <span className="badge badge--neutral">Closed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="all-h">
        <h2 className="syne" id="all-h">Everyone who signed up</h2>
        <p>From volunteer registrations, the Support page and project and event pages.{list.length > 0 && <> <a href="/admin/volunteers.csv">Download CSV</a></>}</p>
        {list.length === 0 ? <p className="admin-empty">No volunteer signups yet.</p> : (
          <table className="admin-table">
            <thead><tr><th>Volunteer</th><th>For</th><th>Skills</th><th>Signed up</th></tr></thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.name}</strong>{v.status === "waitlist" && <> <span className="badge badge--wait">Waitlist</span></>}<br /><a href={`mailto:${v.email}`}>{v.email}</a>{v.phone ? <><br /><a href={`tel:${v.phone}`}>{v.phone}</a></> : null}</td>
                  <td>{forWhat(v)}</td>
                  <td>{v.skills ?? "—"}</td>
                  <td>{formatDate(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

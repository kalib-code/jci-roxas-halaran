import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listEvents } from "@/lib/engagement/events.js";
import { formatDateTime } from "@/lib/format.js";

export const metadata = { title: "Events — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminEvents() {
  await requireArea("content");
  const { upcoming, past } = await listEvents(getDb());
  const row = (e) => (
    <tr key={e.id}>
      <td><Link href={`/admin/events/${e.id}`}>{e.title}</Link></td>
      <td>{formatDateTime(e.startAt)}</td>
      <td>{e.going}{e.capacity ? ` / ${e.capacity}` : ""}{e.waitlist ? ` (+${e.waitlist} waitlist)` : ""}</td>
      <td>{e.rsvpOpen ? "Open" : "Closed"}</td>
    </tr>
  );
  return (
    <div className="admin">
      <h1>Events</h1>
      <p><Link className="btn" href="/admin/events/new">New event</Link></p>
      <table className="admin-table">
        <thead><tr><th>Event</th><th>When</th><th>Going</th><th>RSVP</th></tr></thead>
        <tbody>{upcoming.map(row)}{past.map(row)}</tbody>
      </table>
    </div>
  );
}

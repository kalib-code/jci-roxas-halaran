import Link from "next/link";
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { listRsvpsForEmail } from "@/lib/engagement/events.js";
import { formatDateTime, phNow } from "@/lib/format.js";

export const metadata = { title: "My events" };
export const dynamic = "force-dynamic";

export default async function MyEvents() {
  const { member } = await currentMember();
  if (!member) return <><h1>My events</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  const rows = await listRsvpsForEmail(getDb(), member.email);
  const now = phNow();
  const upcoming = rows.filter((r) => r.startAt >= now);
  const past = rows.filter((r) => r.startAt < now).reverse();
  const row = (r) => (
    <tr key={r.id}>
      <td><Link href={`/events/${r.slug}`}>{r.title}</Link></td>
      <td>{formatDateTime(r.startAt)}</td>
      <td>{r.status}{r.attended ? " · attended" : ""}</td>
    </tr>
  );
  return (
    <>
      <h1>My events</h1>
      <h2 className="syne">Upcoming</h2>
      {upcoming.length ? <table className="admin-table"><tbody>{upcoming.map(row)}</tbody></table> : <p>None yet. <Link href="/events">See events →</Link></p>}
      <h2 className="syne">Past</h2>
      {past.length ? <table className="admin-table"><tbody>{past.map(row)}</tbody></table> : <p>No past events.</p>}
    </>
  );
}

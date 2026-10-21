import Link from "next/link";
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { listRsvpsForEmail } from "@/lib/engagement/events.js";
import { formatDateTime, phNow } from "@/lib/format.js";
import StatusBadge from "@/components/admin/StatusBadge.jsx";

export const metadata = { title: "My events" };
export const dynamic = "force-dynamic";

export default async function MyEvents() {
  const { member } = await currentMember();
  if (!member) return <><h1>My events</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  const rows = await listRsvpsForEmail(getDb(), member.email);
  const now = phNow();
  const upcoming = rows.filter((r) => r.startAt >= now);
  const past = rows.filter((r) => r.startAt < now).reverse();
  const card = (r) => (
    <li key={r.id} className="dash-card">
      <span className="dash-card__title"><Link href={`/events/${r.slug}`}>{r.title}</Link></span>
      <span className="dash-card__text">{formatDateTime(r.startAt)}</span>
      <span className="mevent__status"><StatusBadge status={r.status} />{r.attended ? <StatusBadge status="attended" /> : null}</span>
    </li>
  );
  return (
    <>
      <h1>My events</h1>
      <h2 className="syne">Upcoming</h2>
      {upcoming.length ? <ul className="mevents">{upcoming.map(card)}</ul> : <p>None yet. <Link href="/events">See events →</Link></p>}
      <h2 className="syne">Past</h2>
      {past.length ? <ul className="mevents">{past.map(card)}</ul> : <p>No past events.</p>}
    </>
  );
}

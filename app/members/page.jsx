import Link from "next/link";
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { getPassport, KIND_LABELS } from "@/lib/members/passport.js";
import { listRsvpsForEmail } from "@/lib/engagement/events.js";
import { formatDate, formatDateTime, phNow } from "@/lib/format.js";
import MemberCard from "@/components/members/MemberCard.jsx";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

const NotLinked = () => (
  <>
    <h1>Members</h1>
    <p>Your account isn't linked to a member profile yet — ask an admin to add your email to your member record.</p>
  </>
);

export default async function MembersHome() {
  const { member } = await currentMember();
  if (!member) return <NotLinked />;
  const db = getDb();
  const [passport, rsvps] = await Promise.all([getPassport(db, member.id), listRsvpsForEmail(db, member.email)]);
  const next = rsvps.find((r) => r.startAt >= phNow() && r.status !== "cancelled");
  const missing = [["photo", member.photoUrl], ["profession", member.profession], ["skills", member.skills], ["bio", member.bio]].filter(([, v]) => !v).map(([k]) => k);
  return (
    <>
      <h1>Welcome, {member.name.split(" ")[0]}</h1>
      <div className="members-home">
        <MemberCard member={member} />
        <div>
          <section>
            <h2 className="syne">Your profile</h2>
            {missing.length ? <p>Add your {missing.join(", ")} so other members can find you. <Link href="/members/profile">Edit profile →</Link></p> : <p>Your profile is complete. <Link href="/members/profile">Edit →</Link></p>}
            <p>{member.inDirectory ? "You appear in the member directory." : "You're hidden from the member directory."}</p>
          </section>
          <section>
            <h2 className="syne">Leadership Passport — {passport.points} points</h2>
            <p className="badges">{passport.badges.map((b) => <span className="badge" key={b.key}>{b.label}</span>)}</p>
            <ul>{passport.entries.slice(0, 3).map((e) => <li key={e.id}>{KIND_LABELS[e.kind]}: {e.title} ({formatDate(e.date)})</li>)}</ul>
            <p><Link href="/members/passport">Open your passport →</Link></p>
          </section>
          <section>
            <h2 className="syne">Next event</h2>
            {next ? <p><Link href={`/events/${next.slug}`}>{next.title}</Link>, {formatDateTime(next.startAt)}{next.status === "waitlist" ? " (waitlist)" : ""}</p> : <p>No upcoming RSVPs. <Link href="/events">See events →</Link></p>}
          </section>
        </div>
      </div>
    </>
  );
}

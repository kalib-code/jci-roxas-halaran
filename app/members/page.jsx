import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { getPassport } from "@/lib/members/passport.js";
import { listRsvpsForEmail } from "@/lib/engagement/events.js";
import { cardIsPublic, profileCompleteness } from "@/lib/members/card-view.js";
import { cardUrl, originFrom } from "@/lib/members/qr.js";
import { formatDateTime, initials, phNow } from "@/lib/format.js";
import CardShare from "@/components/members/CardShare.jsx";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

export default async function MembersHome() {
  const { member } = await currentMember();
  if (!member) {
    return (
      <>
        <h1>Members</h1>
        <p>Your account isn't linked to a member profile yet — ask an admin to add your email to your member record.</p>
      </>
    );
  }
  const db = getDb();
  const [passport, rsvps] = await Promise.all([getPassport(db, member.id), listRsvpsForEmail(db, member.email)]);
  const next = rsvps.find((r) => r.startAt >= phNow() && r.status !== "cancelled");
  const { pct, missing } = profileCompleteness(member);
  const live = cardIsPublic(member);
  const url = cardUrl(originFrom(await headers()), member.slug);
  return (
    <>
      <h1>Welcome, {member.name.split(" ")[0]}</h1>
      <section className="mhome__profile">
        <div className="mhome__avatar">
          {member.photoUrl ? <Image src={member.photoUrl} alt={member.name} fill sizes="88px" style={{ objectFit: "cover", objectPosition: "top" }} /> : <span aria-hidden="true">{initials(member.name)}</span>}
        </div>
        <div className="mhome__who">
          <p className="mhome__name">{member.name}</p>
          <p className="label">{member.status}{member.feePaidYear ? ` · dues paid ${member.feePaidYear}` : ""}</p>
          <div className="dash-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
          <p>Profile {pct}% complete{missing.length ? <> — add your {missing.join(", ")}. <Link href="/members/profile">Edit profile →</Link></> : "."}</p>
        </div>
      </section>
      <div className="mhome">
        <section className="dash-card mhome__tile">
          <span className="dash-card__title">Leadership Passport</span>
          <span className="mhome__points">{passport.points} points</span>
          <span className="badges">{passport.badges.slice(0, 4).map((b) => <span className="passport-badge" key={b.key}>{b.label}</span>)}</span>
          <Link href="/members/passport">Open your passport →</Link>
        </section>
        <section className="dash-card mhome__tile">
          <span className="dash-card__title">Next event</span>
          {next ? <span><Link href={`/events/${next.slug}`}>{next.title}</Link>, {formatDateTime(next.startAt)}{next.status === "waitlist" ? " (waitlist)" : ""}</span> : <span>No upcoming RSVPs. <Link href="/events">See events →</Link></span>}
        </section>
        <section className="dash-card mhome__tile mhome__card">
          <span className="dash-card__title">Your e-calling card</span>
          {live ? (
            <>
              <span>Live at <a href={url}>{url}</a></span>
              <CardShare url={url} slug={member.slug} />
            </>
          ) : (
            <>
              <span>{member.status === "active" ? "Share your contact details with a link or QR code." : "Cards are for active members."}</span>
              {member.status === "active" && <Link className="btn" href="/members/profile#card">Set up your e-calling card</Link>}
            </>
          )}
        </section>
      </div>
    </>
  );
}

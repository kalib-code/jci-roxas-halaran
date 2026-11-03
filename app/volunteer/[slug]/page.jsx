import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter.jsx";
import DriveSignupForm from "@/components/forms/DriveSignupForm.jsx";
import { getDb } from "@/lib/db.js";
import { getDriveBySlug, driveIsOpen, seatFor } from "@/lib/engagement/volunteers.js";
import { formatDate, formatDateTime } from "@/lib/format.js";
import { pageMetadata } from "@/lib/seo.js";

// Spots change with every sign-up, so always read them fresh.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const drive = await getDriveBySlug(getDb(), slug);
  if (!drive) return { title: "Page not found", robots: { index: false } };
  return pageMetadata({
    title: drive.title,
    description: `Volunteer with JCI Roxas Halaran: ${drive.title}${drive.startsAt ? `, ${formatDateTime(drive.startsAt)}` : ""}${drive.venue ? ` at ${drive.venue}` : ""}. Sign up in a minute.`,
    path: `/volunteer/${slug}`,
  });
}

export default async function VolunteerDrivePage({ params }) {
  const { slug } = await params;
  const drive = await getDriveBySlug(getDb(), slug);
  if (!drive) notFound();
  const open = driveIsOpen(drive);
  const roles = drive.roles.map((r) => ({ id: r.id, label: r.label, description: r.description, slots: r.slots, taken: r.taken, seat: seatFor(r, r.taken) }));
  return (
    <>
      <header className="section drive-hero">
        <p className="label">Volunteer</p>
        <h1 className="event-hero__title">{drive.title}</h1>
        <ul className="event-facts">
          {drive.startsAt && <li><span className="event-facts__k">When</span><span className="event-facts__v"><time dateTime={drive.startsAt}>{formatDateTime(drive.startsAt)}</time></span></li>}
          {drive.venue && <li><span className="event-facts__k">Where</span><span className="event-facts__v">{drive.venue}</span></li>}
          {drive.eventSlug && <li><span className="event-facts__k">Event</span><span className="event-facts__v"><Link href={`/events/${drive.eventSlug}`}>{drive.eventTitle}</Link></span></li>}
          {drive.projectSlug && <li><span className="event-facts__k">Project</span><span className="event-facts__v"><Link href={`/projects/${drive.projectSlug}`}>{drive.projectTitle}</Link></span></li>}
          {open && drive.closesOn && <li><span className="event-facts__k">Sign up by</span><span className="event-facts__v">{formatDate(drive.closesOn)}</span></li>}
        </ul>
      </header>
      {drive.description && (
        <section className="section">
          <div className="section__bar"><h2>What you&apos;ll do</h2></div>
          <p className="drive-desc">{drive.description}</p>
        </section>
      )}
      <section className="section section--line-top" id="sign-up">
        <div className="section__bar"><h2>Sign up</h2><span className="label">{open ? "Free" : "Closed"}</span></div>
        {open ? <DriveSignupForm driveId={drive.id} roles={roles} /> : (
          <p className="form-errors">Sign-ups for this are closed. Thank you for wanting to help! See our <Link href="/events">upcoming events</Link> for the next chance to volunteer.</p>
        )}
      </section>
      <SiteFooter />
    </>
  );
}

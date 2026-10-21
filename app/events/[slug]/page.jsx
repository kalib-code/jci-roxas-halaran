import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { SafeHtml } from "@/components/SafeHtml.jsx";
import RsvpForm from "@/components/forms/RsvpForm.jsx";
import VolunteerForm from "@/components/forms/VolunteerForm.jsx";
import { getDb } from "@/lib/db.js";
import { getEventBySlug, listEvents } from "@/lib/engagement/events.js";
import { formatDateTime, phNow } from "@/lib/format.js";
import { pageMetadata, breadcrumbLd, eventLd } from "@/lib/seo.js";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  const { upcoming, past } = await listEvents(getDb());
  return [...upcoming, ...past].map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const event = await getEventBySlug(getDb(), slug);
  if (!event) return { title: "Page not found", robots: { index: false } };
  return pageMetadata({
    title: event.title,
    description: `${event.title} — ${formatDateTime(event.startAt)}${event.venue ? `, ${event.venue}` : ""}. RSVP to this JCI Roxas Halaran event.`,
    path: `/events/${slug}`,
  });
}

export default async function EventPage({ params }) {
  const { slug } = await params;
  const event = await getEventBySlug(getDb(), slug);
  if (!event) notFound();
  const isPast = (event.endAt || event.startAt) < phNow();
  const full = Boolean(event.capacity) && event.going >= event.capacity;
  return (
    <>
      <JsonLd data={eventLd(event)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }, { name: event.title, path: `/events/${slug}` }])} />
      <header className="page-hero">
        <p className="label">{formatDateTime(event.startAt)}{event.venue ? ` · ${event.venue}` : ""}</p>
        <h1>{event.title}</h1>
        <p><a href={`/events/${slug}/ics`}>Add to calendar</a>{event.capacity ? ` · ${Math.max(event.capacity - event.going, 0)} of ${event.capacity} spots left` : ""}</p>
      </header>
      {event.coverUrl && (
        <figure className="article__cover">
          <Image src={event.coverUrl} alt={event.coverAlt ?? event.title} fill sizes="100vw" style={{ objectFit: "cover" }} priority />
        </figure>
      )}
      <section className="section">
        {event.description ? <SafeHtml className="article-body" html={event.description} /> : null}
      </section>
      {!isPast && event.rsvpOpen && (
        <section className="section section--line-top" id="rsvp">
          <div className="section__bar"><h2>RSVP</h2><span className="label">{full ? "Waitlist" : "Free"}</span></div>
          <RsvpForm eventId={event.id} full={full} />
        </section>
      )}
      {!isPast && (
        <section className="section" id="volunteer">
          <div className="section__bar"><h2>Volunteer</h2><span className="label">Help out</span></div>
          <VolunteerForm eventId={event.id} />
        </section>
      )}
      <p className="section"><Link className="btn" href="/events">All events</Link></p>
      <SiteFooter />
    </>
  );
}

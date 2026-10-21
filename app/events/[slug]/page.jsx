import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import Contours from "@/components/Contours.jsx";
import { SafeHtml } from "@/components/SafeHtml.jsx";
import RsvpForm from "@/components/forms/RsvpForm.jsx";
import VolunteerForm from "@/components/forms/VolunteerForm.jsx";
import { spotsBadge } from "@/components/EventRow.jsx";
import { getDb } from "@/lib/db.js";
import { getEventBySlug, listEvents } from "@/lib/engagement/events.js";
import { formatDateTime, phNow } from "@/lib/format.js";
import { eventDateParts, mapsUrl } from "@/lib/eventDates.js";
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
  const d = eventDateParts(event.startAt, event.endAt);
  const badge = isPast ? null : spotsBadge(event);
  const map = mapsUrl(event.venue);
  const canRsvp = !isPast && event.rsvpOpen;
  return (
    <>
      <JsonLd data={eventLd(event)} />
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }, { name: event.title, path: `/events/${slug}` }])} />
      <header className="section event-hero">
        <figure className="event-hero__media">
          {event.coverUrl ? (
            <Image src={event.coverUrl} alt={event.coverAlt ?? event.title} fill sizes="(max-width: 900px) 100vw, 45vw" style={{ objectFit: "cover" }} priority />
          ) : (
            <div className="event-hero__poster" aria-hidden="true">
              <Contours variant="quote" />
              <span className="event-hero__day">{d?.day}</span>
              <span className="event-hero__month">{d?.month}</span>
            </div>
          )}
        </figure>
        <div className="event-hero__body">
          <p className="label">{isPast ? "Past event" : "Event"}</p>
          <h1 className="event-hero__title">{event.title}</h1>
          <ul className="event-facts">
            {d && (
              <li>
                <span className="event-facts__k">When</span>
                <span className="event-facts__v">
                  <time dateTime={event.startAt}>{d.date}</time><br />{d.time}{d.endDate ? ` · until ${d.endDate}` : ""}
                  {!isPast && <><br /><a href={`/events/${slug}/ics`}>Add to calendar</a></>}
                </span>
              </li>
            )}
            {event.venue && (
              <li>
                <span className="event-facts__k">Where</span>
                <span className="event-facts__v">
                  {event.venue}
                  {map && <><br /><a href={map} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></>}
                </span>
              </li>
            )}
          </ul>
          {badge && <span className={`erow__badge erow__badge--${badge.tone}`}>{badge.text}</span>}
          {canRsvp && <p><a className="btn btn--lg" href="#rsvp">{full ? "Join the waitlist" : "RSVP"}</a></p>}
        </div>
      </header>

      {event.description && (
        <section className="section">
          <div className="section__bar"><h2>About this event</h2></div>
          <SafeHtml className="article-body" html={event.description} />
        </section>
      )}
      {canRsvp && (
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
      {canRsvp && (
        <div className="event-bar" role="region" aria-label="RSVP">
          <span className="event-bar__title">{event.title}</span>
          <a className="btn" href="#rsvp">{full ? "Waitlist" : "RSVP"}</a>
        </div>
      )}
      <SiteFooter />
    </>
  );
}

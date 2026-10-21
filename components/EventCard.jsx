import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import { formatDateTime } from "@/lib/format.js";

export default function EventCard({ event }) {
  const spots = event.capacity ? Math.max(event.capacity - event.going, 0) : null;
  return (
    <article className="project">
      <Link href={`/events/${event.slug}`} className="article-card__link">
        <figure>
          {event.coverUrl ? (
            <Image src={event.coverUrl} alt={event.coverAlt ?? ""} fill sizes="(max-width: 900px) 100vw, 33vw" style={{ objectFit: "cover" }} />
          ) : (
            <div className="project__placeholder" aria-hidden="true"><Contours variant="quote" /><span>Event</span></div>
          )}
        </figure>
        <div className="project__meta">
          <h3>{event.title}</h3>
          <time className="label label--sm" dateTime={event.startAt}>{formatDateTime(event.startAt)}</time>
        </div>
        <p className="article-card__excerpt">
          {event.venue ?? "Roxas City"} · {spots === null ? "Open to all" : spots > 0 ? `${spots} spots left` : "Full — waitlist open"}
        </p>
      </Link>
    </article>
  );
}

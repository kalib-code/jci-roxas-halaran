import Link from "next/link";
import Image from "next/image";
import { eventDateParts } from "@/lib/eventDates.js";

export function spotsBadge(event) {
  if (!event.capacity) return null;
  const left = Math.max(event.capacity - event.going, 0);
  return left > 0 ? { text: `${left} spot${left === 1 ? "" : "s"} left`, tone: left <= 10 ? "low" : "open" } : { text: "Full · waitlist open", tone: "full" };
}

// One agenda row: date block, details, optional photo on the right.
export default function EventRow({ event, past = false }) {
  const d = eventDateParts(event.startAt, event.endAt);
  const badge = past ? null : spotsBadge(event);
  return (
    <article className={`erow${past ? " erow--past" : ""}`}>
      <Link href={`/events/${event.slug}`} className="erow__link">
        <div className="erow__date" aria-hidden="true">
          <span className="erow__day">{d?.day ?? "—"}</span>
          <span className="erow__month">{d?.month ?? ""}</span>
        </div>
        <div className="erow__body">
          <h3 className="erow__title">{event.title}</h3>
          <p className="erow__meta">
            {d && <time dateTime={event.startAt}>{d.date} · {d.time}</time>}
            {event.venue && <span>{event.venue}</span>}
          </p>
          {badge && <span className={`erow__badge erow__badge--${badge.tone}`}>{badge.text}</span>}
        </div>
        {event.coverUrl && (
          <figure className="erow__photo">
            <Image src={event.coverUrl} alt={event.coverAlt ?? ""} fill sizes="160px" style={{ objectFit: "cover" }} />
          </figure>
        )}
      </Link>
    </article>
  );
}

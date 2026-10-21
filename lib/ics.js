const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
const esc = (s = "") => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const localToUtc = (local) => new Date(new Date(`${local.slice(0, 16)}:00Z`).getTime() - PH_OFFSET_MS);
const plusHours = (local, h) => new Date(new Date(`${local.slice(0, 16)}:00Z`).getTime() + h * 3600 * 1000).toISOString().slice(0, 16);

export function buildIcs(event, { siteUrl, now = new Date() }) {
  const end = event.endAt || plusHours(event.startAt, 2);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JCI Roxas Halaran//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:event-${event.id}@jciroxashalaran.com`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(localToUtc(event.startAt))}`,
    `DTEND:${stamp(localToUtc(end))}`,
    `SUMMARY:${esc(event.title)}`,
    event.venue ? `LOCATION:${esc(event.venue)}` : null,
    `URL:${siteUrl}/events/${event.slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n")
    .concat("\r\n");
}

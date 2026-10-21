// Display pieces for event times, which are stored as Philippine local time
// "YYYY-MM-DDTHH:mm". Read as UTC so the server's own timezone never shifts them.

const part = (opts) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
const MONTH = part({ month: "short" });
const MONTH_YEAR = part({ month: "long", year: "numeric" });
const WEEKDAY_DATE = part({ weekday: "long", month: "long", day: "numeric", year: "numeric" });
const TIME = part({ hour: "numeric", minute: "2-digit" });

const toDate = (local) => (local ? new Date(`${local.slice(0, 16)}:00Z`) : null);
const clean = (s) => s.replace(/ /g, " ");

export function eventDateParts(startAt, endAt = null) {
  const start = toDate(startAt);
  if (!start || Number.isNaN(start.getTime())) return null;
  const end = toDate(endAt);
  const sameDay = end && endAt.slice(0, 10) === startAt.slice(0, 10);
  const time = clean(TIME.format(start)) + (sameDay ? ` – ${clean(TIME.format(end))}` : "");
  return {
    day: String(start.getUTCDate()),
    month: MONTH.format(start).toUpperCase(),
    monthKey: startAt.slice(0, 7),
    monthLabel: MONTH_YEAR.format(start),
    date: WEEKDAY_DATE.format(start),
    time,
    endDate: end && !sameDay ? WEEKDAY_DATE.format(end) : null,
  };
}

// [{ key: "2026-11", label: "November 2026", events: [...] }, ...] in the given order.
export function groupByMonth(events) {
  const groups = [];
  for (const e of events) {
    const parts = eventDateParts(e.startAt);
    const key = parts?.monthKey ?? "undated";
    let g = groups.at(-1);
    if (!g || g.key !== key) groups.push((g = { key, label: parts?.monthLabel ?? "Date to be announced", events: [] }));
    g.events.push(e);
  }
  return groups;
}

export const mapsUrl = (venue) =>
  venue ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venue}, Capiz, Philippines`)}` : null;

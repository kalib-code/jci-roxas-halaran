// Layout rules for the printed JCI Philippines attendance sheet (2026 template):
// A4 on the national letterhead, the event details centred on every page.

// Rows that fit between the letterhead's header and footer art.
export const ROWS_PER_PAGE = { portrait: 18, landscape: 10 };
// The certification block needs about this many rows of space on the last page.
const CERTIFY_ROWS = 6;

// Splits rows into pages. With `certify`, the last page keeps room for the
// signatures, adding a page for them if the rows fill it.
export function sheetPages(rows, { layout = "portrait", certify = false, blankRows = 0 } = {}) {
  const per = ROWS_PER_PAGE[layout] ?? ROWS_PER_PAGE.portrait;
  const all = blankRows ? Array.from({ length: blankRows }, () => null) : rows;
  const pages = [];
  for (let i = 0; i < all.length; i += per) pages.push(all.slice(i, i + per));
  if (pages.length === 0) pages.push([]);
  if (certify && pages.at(-1).length > per - CERTIFY_ROWS) pages.push([]);
  return pages;
}

// The template's two tables: Name | Position for a chapter-only activity, and
// Name | Local Organization | Position once anyone from elsewhere attends.
export const needsOrganizationColumn = (rows) => rows.some((r) => r.affiliation !== "home");

const DAY = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const CLOCK = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const clean = (s) => s.replace(/ /g, " ");
const local = (v) => new Date(`${v.slice(0, 16)}:00Z`);

// "January 15, 2027 · 6:00 PM – 9:00 PM" from the event's Philippine local times.
export function eventWhen(event) {
  const start = local(event.startAt);
  const end = event.endAt ? local(event.endAt) : null;
  const day = clean(DAY.format(start));
  if (!end) return `${day} · ${clean(CLOCK.format(start))}`;
  if (event.endAt.slice(0, 10) !== event.startAt.slice(0, 10)) return `${day}, ${clean(CLOCK.format(start))} – ${clean(DAY.format(end))}, ${clean(CLOCK.format(end))}`;
  return `${day} · ${clean(CLOCK.format(start))} – ${clean(CLOCK.format(end))}`;
}

const STAMP_TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Asia/Manila" });
const STAMP_DATED = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const STAMP_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" });

// A check-in timestamp in Philippine time, with the date when it isn't the event day.
export function timeIn(iso, eventDay) {
  const at = new Date(iso);
  return clean(STAMP_DAY.format(at) === eventDay ? STAMP_TIME.format(at) : STAMP_DATED.format(at));
}

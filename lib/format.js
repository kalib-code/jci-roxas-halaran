const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv"]);

// Two-letter initials from the first and last real name parts
// ("Elmer D. Jimenez Jr." -> "EJ").
export function initials(name) {
  const parts = name
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}]/gu, ""))
    .filter((w) => w.length > 1 && !SUFFIXES.has(w.toLowerCase()));
  if (parts.length === 0) return name.slice(0, 1).toUpperCase();
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : DATE_FORMAT.format(d);
}

// "6 min read" for an article body (stored HTML). Return null to hide it.
export function readingTime(html) {
  // TODO(Karl): strip tags, count words, pick a words-per-minute rate.
  return null;
}

export function slugify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

// Event times are stored as Philippine local time "YYYY-MM-DDTHH:mm" (UTC+8, no DST).
export function phNow(now = new Date()) {
  return new Date(now.getTime() + PH_OFFSET_MS).toISOString().slice(0, 16);
}

const DATETIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDateTime(local) {
  if (!local) return null;
  const d = new Date(`${local.slice(0, 16)}:00Z`);
  return Number.isNaN(d.getTime()) ? null : DATETIME_FORMAT.format(d).replace(/\u202f/g, " ");
}

export function ageOn(birthdate, today) {
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

const PESOS = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
export function formatPesos(centavos) {
  return PESOS.format(Math.round(centavos / 100));
}

// The Philippine calendar date for an ISO timestamp (ages, join dates, fee years).
export function phToday(nowIso = new Date().toISOString()) {
  return phNow(new Date(nowIso)).slice(0, 10);
}

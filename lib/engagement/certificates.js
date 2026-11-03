import { randomBytes } from "node:crypto";
import { and, asc, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { attendance, events } from "../../db/schema.js";
import { SITE } from "../site.js";
import { sheetCertifiers } from "./attendance.js";
import { eventWhen } from "./attendance-sheet.js";

const HOUR = 60 * 60 * 1000;
// Without an end time, an event is taken to run three hours.
const DEFAULT_LENGTH = 3 * HOUR;
// Certificates go out an hour after the event ends, so late fixes to names make it in.
export const SEND_AFTER = HOUR;
// Older events are left alone: turning this on never mails people about past events.
const LOOK_BACK = 14 * 24 * HOUR;

const phTime = (local) => new Date(`${local.slice(0, 16)}:00+08:00`).getTime();
export const eventEndsAt = (event) => (event.endAt ? phTime(event.endAt) : phTime(event.startAt) + DEFAULT_LENGTH);

export const newCertificateCode = () => randomBytes(9).toString("base64url");
export const certificateUrl = (code) => `${SITE.url}/certificate/${encodeURIComponent(code)}`;

// Everyone owed a certificate now: checked in with an email (online: through to
// the end code), not yet sent, at an event that ended at least an hour ago (and
// not more than two weeks ago).
export async function dueCertificates(db, { now = new Date(), eventId = null, limit = 40 } = {}) {
  const rows = await db
    .select({ attendee: attendance, event: events })
    .from(attendance)
    .innerJoin(events, eq(attendance.eventId, events.id))
    .where(
      and(
        isNotNull(attendance.email),
        isNull(attendance.certificateSentAt),
        or(ne(attendance.source, "online"), isNotNull(attendance.checkedOutAt)),
        eventId ? eq(events.id, Number(eventId)) : undefined,
      ),
    )
    .orderBy(asc(attendance.checkedInAt), asc(attendance.id));
  const t = now.getTime();
  // An organizer pressing "Send now" skips the wait, but never before the event starts.
  const due = ({ event }) =>
    eventId ? phTime(event.startAt) <= t : eventEndsAt(event) + SEND_AFTER <= t && eventEndsAt(event) >= t - LOOK_BACK;
  return rows.filter(due).slice(0, limit);
}

// What a certificate shows, or null if the ID isn't one we issued (or the person
// was later removed from the attendance sheet).
export async function certificateView(db, code) {
  if (!code) return null;
  const [row] = await db
    .select({ attendee: attendance, event: events })
    .from(attendance)
    .innerJoin(events, eq(attendance.eventId, events.id))
    .where(eq(attendance.certificateCode, String(code)));
  if (!row) return null;
  const { attendee, event } = row;
  const certifiers = await sheetCertifiers(db, event);
  const signers = [
    [certifiers.president, "LO President"],
    [certifiers.secretary, "LO Secretary"],
    [certifiers.chairperson, "Project Chairperson"],
  ].filter(([name]) => name);
  return {
    code: attendee.certificateCode,
    name: attendee.name,
    position: attendee.position,
    localOrganization: attendee.localOrganization,
    eventTitle: event.title,
    when: eventWhen(event),
    venue: event.venue,
    issuedAt: attendee.certificateSentAt,
    signers,
    url: certificateUrl(attendee.certificateCode),
  };
}

const DAY = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" });
export const issuedOn = (iso) => (iso ? DAY.format(new Date(iso)) : null);

// Gives the row its ID, emails the certificate, then marks it sent. A failed
// email leaves it unsent, so the next hourly run tries again.
export async function issueCertificate(db, { attendee, event }, { render, send, now = new Date() }) {
  let code = attendee.certificateCode;
  if (!code) {
    code = newCertificateCode();
    await db.update(attendance).set({ certificateCode: code }).where(eq(attendance.id, attendee.id));
  }
  const view = await certificateView(db, code);
  const png = await render({ ...view, issuedAt: now.toISOString() });
  const result = await send({
    to: attendee.email,
    subject: `Certificate of attendance: ${event.title}`,
    text: [
      `Hi ${attendee.name},`,
      "",
      `Thank you for joining ${event.title} (${view.when}${event.venue ? `, ${event.venue}` : ""}). Your certificate of attendance from ${SITE.name} is attached.`,
      "",
      `View, download or verify it any time: ${view.url}`,
      "",
      SITE.name,
    ].join("\n"),
    attachments: [{ filename: `certificate-${code}.png`, content: Buffer.from(png).toString("base64") }],
  });
  if (!result?.sent) return { ok: false, error: result?.reason ?? "not sent" };
  await db.update(attendance).set({ certificateSentAt: now.toISOString() }).where(eq(attendance.id, attendee.id));
  return { ok: true, code };
}

// Sends every certificate that's due, one at a time to stay under the email
// provider's rate limit.
export async function sendDueCertificates(db, { render, send, now = new Date(), eventId = null, pause = 600, limit } = {}) {
  const due = await dueCertificates(db, { now, eventId, limit });
  const result = { sent: 0, failed: [] };
  for (const [i, row] of due.entries()) {
    if (i > 0 && pause) await new Promise((r) => setTimeout(r, pause));
    try {
      const r = await issueCertificate(db, row, { render, send, now });
      if (r.ok) result.sent += 1;
      else result.failed.push({ name: row.attendee.name, error: r.error });
    } catch (e) {
      result.failed.push({ name: row.attendee.name, error: e.message });
    }
  }
  return result;
}

"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForEvent, revalidateAll } from "@/lib/revalidate.js";
import { saveEvent, setAttendance, moveToGoing, getEvent, listRsvps } from "@/lib/engagement/events.js";
import { syncAttendanceEntry } from "@/lib/members/passport.js";
import { setCheckin, setCheckinNearby, addAttendee, updateAttendee, removeAttendee, syncRsvpAttendance } from "@/lib/engagement/attendance.js";
import { findPlaces } from "@/lib/maps-link.js";
import { formatDistance, NEARBY_M } from "@/lib/proof/location.js";
import { changedFields } from "@/lib/audit.js";
import { sendEmail } from "@/lib/email.js";
import { sendDueCertificates } from "@/lib/engagement/certificates.js";
import { renderCertificate } from "@/lib/engagement/certificate-image.jsx";
import { audit } from "@/lib/audit.js";

export async function saveEventAction(input) {
  const { userId } = await requireArea("content");
  const r = await saveEvent(getDb(), input);
  if (r.ok) {
    revalidateAll(pathsForEvent(r.event.slug));
    await audit(getDb(), { actor: userId, action: input?.id ? "event.update" : "event.create", table: "events", id: r.event.id, summary: `${input?.id ? "Edited" : "Created"} event "${r.event.title}"` });
  }
  return r;
}

export async function setAttendanceAction(rsvpId, attended) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await setAttendance(db, rsvpId, attended, { userId });
  if (r.ok) {
    await syncAttendanceEntry(db, r.rsvp, attended);
    await syncRsvpAttendance(db, r.rsvp, attended, { userId });
    await audit(db, { actor: userId, action: "rsvp.attendance", table: "rsvps", id: r.rsvp.id, summary: `Marked ${r.rsvp.name} as ${attended ? "attended" : "not attended"}` });
  }
  return r;
}

export async function moveToGoingAction(rsvpId, eventId) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await moveToGoing(db, rsvpId);
  if (r.ok) {
    const event = await getEvent(db, eventId);
    if (event) revalidateAll(pathsForEvent(event.slug));
    await audit(db, { actor: userId, action: "rsvp.move_to_going", table: "rsvps", id: r.rsvp.id, summary: `Moved ${r.rsvp.name} from the waitlist to going${event ? ` for "${event.title}"` : ""}` });
    revalidatePath(`/admin/events/${eventId}`);
  }
  return r;
}

export async function rsvpsForEvent(eventId) {
  await requireArea("content");
  return listRsvps(getDb(), eventId);
}

export async function setCheckinAction(eventId, { open, newCode = false }) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await setCheckin(db, eventId, { open, newCode });
  if (r.ok) {
    const what = newCode ? "Made a new check-in QR for" : `${open ? "Opened" : "Closed"} check-in for`;
    await audit(db, { actor: userId, action: newCode ? "checkin.new_code" : open ? "checkin.open" : "checkin.close", table: "events", id: r.event.id, summary: `${what} "${r.event.title}"` });
    revalidatePath(`/admin/events/${r.event.id}`);
  }
  return r;
}

// Turns the venue check on or off. `place` is what the organizer pasted (a Google
// Maps link or "lat, lng"), or the coordinates their phone gave.
// Places on the map matching what an organizer typed, for pinning the venue.
export async function findVenueAction(text) {
  await requireArea("content");
  const query = String(text ?? "").trim().slice(0, 200);
  if (query.length < 3) return { ok: false, errors: ["Type at least 3 letters of the venue's name."] };
  try {
    return { ok: true, places: await findPlaces(query) };
  } catch {
    return { ok: false, errors: ["The map search isn't answering right now. Drag the map to the venue instead."] };
  }
}

// `place` is the pin from the map: { lat, lng }.
export async function setCheckinNearbyAction(eventId, { nearby, place = null }) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const pin = place ? { lat: Number(place.lat), lng: Number(place.lng) } : {};
  const r = await setCheckinNearby(db, eventId, { nearby, ...pin });
  if (r.ok) {
    const what = nearby ? `Limited check-in to within ${formatDistance(NEARBY_M)} of the venue` : "Turned off the venue check";
    const pinned = place ? ` (venue pinned at ${r.event.lat}, ${r.event.lng})` : "";
    await audit(db, { actor: userId, action: nearby ? "checkin.nearby_on" : "checkin.nearby_off", table: "events", id: r.event.id, summary: `${what} for "${r.event.title}"${pinned}` });
    revalidatePath(`/admin/events/${r.event.id}`);
  }
  return r;
}

export async function addAttendeeAction(eventId, input) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await addAttendee(db, eventId, input, { userId });
  if (r.ok) await audit(db, { actor: userId, action: "attendance.add", table: "attendance", id: r.attendee.id, summary: `Added ${r.attendee.name} (${r.attendee.localOrganization}) to the attendance sheet` });
  return r;
}

export async function updateAttendeeAction(id, input) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await updateAttendee(db, id, input);
  if (r.ok) {
    const changes = changedFields(r.before, r.attendee, ["name", "position", "localOrganization", "email"]);
    await audit(db, { actor: userId, action: "attendance.update", table: "attendance", id: r.attendee.id, summary: `Edited ${r.attendee.name} on the attendance sheet`, details: changes });
  }
  return r;
}

export async function removeAttendeeAction(id) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await removeAttendee(db, id);
  if (r.ok) await audit(db, { actor: userId, action: "attendance.remove", table: "attendance", id: r.attendee.id, summary: `Removed ${r.attendee.name} from the attendance sheet` });
  return r;
}

// Sends this event's certificates now instead of waiting for the hourly run
// (anyone with an email who hasn't had one yet).
export async function sendCertificatesAction(eventId) {
  const { userId } = await requireArea("content");
  const db = getDb();
  const r = await sendDueCertificates(db, {
    eventId,
    limit: 25,
    render: async (view) => (await renderCertificate(view)).arrayBuffer(),
    send: sendEmail,
  });
  if (r.sent) await audit(db, { actor: userId, action: "certificates.send", table: "events", id: Number(eventId), summary: `Emailed ${r.sent} certificate${r.sent === 1 ? "" : "s"} of attendance`, details: r.failed.length ? { failed: r.failed } : null });
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true, ...r };
}

"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForEvent, revalidateAll } from "@/lib/revalidate.js";
import { saveEvent, setAttendance, moveToGoing, getEvent, listRsvps } from "@/lib/engagement/events.js";
import { syncAttendanceEntry } from "@/lib/members/passport.js";
import { setCheckin, addAttendee, updateAttendee, removeAttendee, syncRsvpAttendance } from "@/lib/engagement/attendance.js";
import { changedFields } from "@/lib/audit.js";
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

"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForEvent, revalidateAll } from "@/lib/revalidate.js";
import { saveEvent, setAttendance, moveToGoing, getEvent, listRsvps } from "@/lib/engagement/events.js";
import { syncAttendanceEntry } from "@/lib/members/passport.js";
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

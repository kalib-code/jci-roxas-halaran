"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db.js";
import { requireArea } from "@/lib/auth.js";
import { pathsForEvent, revalidateAll } from "@/lib/revalidate.js";
import { saveEvent, setAttendance, moveToGoing, getEvent, listRsvps } from "@/lib/engagement/events.js";

export async function saveEventAction(input) {
  await requireArea("content");
  const r = await saveEvent(getDb(), input);
  if (r.ok) revalidateAll(pathsForEvent(r.event.slug));
  return r;
}

export async function setAttendanceAction(rsvpId, attended) {
  const { userId } = await requireArea("content");
  return setAttendance(getDb(), rsvpId, attended, { userId });
}

export async function moveToGoingAction(rsvpId, eventId) {
  await requireArea("content");
  const db = getDb();
  const r = await moveToGoing(db, rsvpId);
  if (r.ok) {
    const event = await getEvent(db, eventId);
    if (event) revalidateAll(pathsForEvent(event.slug));
    revalidatePath(`/admin/events/${eventId}`);
  }
  return r;
}

export async function rsvpsForEvent(eventId) {
  await requireArea("content");
  return listRsvps(getDb(), eventId);
}

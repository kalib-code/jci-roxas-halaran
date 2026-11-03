import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { getEvent, listRsvps } from "@/lib/engagement/events.js";
import EventEditor from "@/components/admin/EventEditor.jsx";
import RsvpTable from "@/components/admin/RsvpTable.jsx";
import AttendancePanel from "@/components/admin/AttendancePanel.jsx";
import LinkedDrives from "@/components/admin/LinkedDrives.jsx";
import DeleteEvent from "@/components/admin/DeleteEvent.jsx";
import { listDrivesFor } from "@/lib/engagement/volunteers.js";
import { listAttendance } from "@/lib/engagement/attendance.js";
import { checkinPanel } from "@/lib/engagement/checkin-panel.js";
import { originFrom } from "@/lib/members/qr.js";

export const metadata = { title: "Edit event — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditEvent({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const found = await getEvent(db, id);
  if (!found) notFound();
  const { event, checkin } = await checkinPanel(db, found, originFrom(await headers()));
  const [projects, rsvps, attendance, drives] = await Promise.all([listProjects(db), listRsvps(db, event.id), listAttendance(db, event.id), listDrivesFor(db, { eventId: event.id })]);
  return (
    <div className="admin">
      <h1>Edit event</h1>
      <EventEditor event={event} projects={projects} />
      <LinkedDrives drives={drives} newHref={`/admin/volunteers/new?event=${event.id}`} />
      <AttendancePanel event={{ id: event.id, title: event.title, startAt: event.startAt, venue: event.venue, weChair: event.weChair, format: event.format, lat: event.lat, lng: event.lng, checkinNearby: event.checkinNearby }} rows={attendance} checkin={checkin} />
      <RsvpTable eventId={event.id} rsvps={rsvps} />
      <DeleteEvent
        event={{ id: event.id, title: event.title }}
        counts={{ rsvps: rsvps.length, attendance: attendance.length, certificates: attendance.filter((a) => a.certificateSentAt).length, drives: drives.length }}
      />
    </div>
  );
}

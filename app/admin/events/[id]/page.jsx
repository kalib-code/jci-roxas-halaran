import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { getEvent, listRsvps } from "@/lib/engagement/events.js";
import EventEditor from "@/components/admin/EventEditor.jsx";
import RsvpTable from "@/components/admin/RsvpTable.jsx";
import AttendancePanel from "@/components/admin/AttendancePanel.jsx";
import { listAttendance, checkinIsOpen } from "@/lib/engagement/attendance.js";
import { qrSvg, checkinUrl, originFrom } from "@/lib/members/qr.js";

export const metadata = { title: "Edit event — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditEvent({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const event = await getEvent(db, id);
  if (!event) notFound();
  const [projects, rsvps, attendance] = await Promise.all([listProjects(db), listRsvps(db, event.id), listAttendance(db, event.id)]);
  const open = checkinIsOpen(event);
  const url = open ? checkinUrl(originFrom(await headers()), event.checkinCode) : null;
  const checkin = { open, url, qrSvg: open ? await qrSvg(url) : null };
  return (
    <div className="admin">
      <h1>Edit event</h1>
      <EventEditor event={event} projects={projects} />
      <AttendancePanel event={{ id: event.id, title: event.title, startAt: event.startAt, weChair: event.weChair }} rows={attendance} checkin={checkin} />
      <RsvpTable eventId={event.id} rsvps={rsvps} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { getEvent, listRsvps } from "@/lib/engagement/events.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import EventEditor from "@/components/admin/EventEditor.jsx";
import RsvpTable from "@/components/admin/RsvpTable.jsx";

export const metadata = { title: "Edit event — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditEvent({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const event = await getEvent(db, id);
  if (!event) notFound();
  const [projects, rsvps] = await Promise.all([listProjects(db), listRsvps(db, event.id)]);
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>Edit event</h1>
      <EventEditor event={event} projects={projects} />
      <RsvpTable eventId={event.id} rsvps={rsvps} />
    </div>
  );
}

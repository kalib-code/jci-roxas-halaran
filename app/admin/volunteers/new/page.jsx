import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { getProject } from "@/lib/content/projects.js";
import { getEvent, listEvents } from "@/lib/engagement/events.js";
import { draftFromEvent, draftFromProject } from "@/lib/engagement/volunteers.js";
import DriveEditor from "@/components/admin/DriveEditor.jsx";

export const metadata = { title: "New volunteer registration — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

// ?event=<id> or ?project=<id> fills it in from that event or project.
export default async function NewDrive({ searchParams }) {
  await requireArea("content");
  const { event: eventId, project: projectId } = await searchParams;
  const db = getDb();
  const [{ upcoming, past }, projects, event, project] = await Promise.all([
    listEvents(db),
    listProjects(db),
    eventId ? getEvent(db, eventId) : null,
    projectId ? getProject(db, projectId) : null,
  ]);
  const draft = event ? draftFromEvent(event) : project ? draftFromProject(project) : {};
  return (
    <div className="admin">
      <p><Link href="/admin/volunteers">← Volunteers</Link></p>
      <h1>New volunteer registration</h1>
      <DriveEditor drive={null} draft={draft} events={[...upcoming, ...past]} projects={projects} />
    </div>
  );
}

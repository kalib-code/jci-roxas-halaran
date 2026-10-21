import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import EventEditor from "@/components/admin/EventEditor.jsx";

export const metadata = { title: "New event — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewEvent() {
  await requireArea("content");
  const projects = await listProjects(getDb());
  return (
    <div className="admin">
      <h1>New event</h1>
      <EventEditor event={null} projects={projects} />
    </div>
  );
}

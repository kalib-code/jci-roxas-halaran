import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getProject, getProjectBySlug } from "@/lib/content/projects.js";
import { listProjectMetrics } from "@/lib/proof/metrics.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ProjectEditor from "@/components/admin/ProjectEditor.jsx";

export const metadata = { title: "Edit project — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditProject({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const row = await getProject(db, id);
  if (!row) notFound();
  const project = await getProjectBySlug(db, row.slug);
  const metrics = await listProjectMetrics(db, row.id);
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>Edit project</h1>
      <ProjectEditor project={project} metrics={metrics} />
    </div>
  );
}

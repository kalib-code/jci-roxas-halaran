import { requireArea } from "@/lib/auth.js";
import ProjectEditor from "@/components/admin/ProjectEditor.jsx";

export const metadata = { title: "New project — Admin", robots: { index: false } };

export default async function NewProject() {
  await requireArea("content");
  return (
    <div className="admin">
      <h1>New project</h1>
      <ProjectEditor project={null} />
    </div>
  );
}

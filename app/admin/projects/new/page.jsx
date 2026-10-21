import { requireArea } from "@/lib/auth.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ProjectEditor from "@/components/admin/ProjectEditor.jsx";

export const metadata = { title: "New project — Admin", robots: { index: false } };

export default async function NewProject() {
  await requireArea("content");
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>New project</h1>
      <ProjectEditor project={null} />
    </div>
  );
}

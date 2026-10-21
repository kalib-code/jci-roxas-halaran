import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listMembers, listProjects } from "@/lib/queries.js";
import { listPlan } from "@/lib/content/seoPlan.js";
import { getArticle } from "@/lib/content/articles.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ArticleEditor from "@/components/admin/ArticleEditor.jsx";

export const metadata = { title: "Edit article — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function EditArticle({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const article = await getArticle(db, id);
  if (!article) notFound();
  const [authors, projects, plan] = await Promise.all([listMembers(db), listProjects(db), listPlan(db)]);
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>Edit article</h1>
      <ArticleEditor article={article} authors={authors} projects={projects} planKeywords={plan.map((p) => p.keyword)} />
    </div>
  );
}

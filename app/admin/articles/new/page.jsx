import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listMembers, listProjects } from "@/lib/queries.js";
import { listPlan } from "@/lib/content/seoPlan.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import ArticleEditor from "@/components/admin/ArticleEditor.jsx";

export const metadata = { title: "New article — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NewArticle({ searchParams }) {
  await requireArea("content");
  const { keyword = "", title = "" } = await searchParams;
  const db = getDb();
  const [authors, projects, plan] = await Promise.all([listMembers(db), listProjects(db), listPlan(db)]);
  return (
    <div className="admin">
      <AdminNav isAdmin />
      <h1>New article</h1>
      <ArticleEditor article={null} authors={authors} projects={projects} planKeywords={plan.map((p) => p.keyword)} prefill={{ targetKeyword: keyword, title }} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getArticle } from "@/lib/content/articles.js";
import ArticleView from "@/components/ArticleView.jsx";

export const metadata = { title: "Preview — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PreviewArticle({ params }) {
  await requireArea("content");
  const { id } = await params;
  const article = await getArticle(getDb(), id);
  if (!article) notFound();
  return (
    <>
      <p className="form-errors" role="status">Preview — {article.status === "published" ? "this is live" : "not public yet"}.</p>
      <ArticleView article={{ ...article, authorName: null }} related={[]} project={null} />
    </>
  );
}

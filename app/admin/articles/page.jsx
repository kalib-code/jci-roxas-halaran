import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listArticlesAdmin } from "@/lib/content/articles.js";
import { CATEGORY_LABELS } from "@/lib/content/validation.js";

export const metadata = { title: "Articles — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminArticles({ searchParams }) {
  await requireArea("content");
  const { status } = await searchParams;
  const list = await listArticlesAdmin(getDb(), { status: ["draft", "published"].includes(status) ? status : undefined });
  return (
    <div className="admin">
      <h1>Articles</h1>
      <p className="actions">
        <Link className="btn" href="/admin/articles/new">New article</Link>
        <Link href="/admin/articles">All</Link>
        <Link href="/admin/articles?status=draft">Drafts</Link>
        <Link href="/admin/articles?status=published">Published</Link>
      </p>
      <table className="admin-table">
        <thead><tr><th>Title</th><th>Status</th><th>Category</th><th>Keyword</th><th>Updated</th></tr></thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id}>
              <td><Link href={`/admin/articles/${a.id}`}>{a.title}</Link></td>
              <td>{a.status}</td>
              <td>{CATEGORY_LABELS[a.category]}</td>
              <td>{a.targetKeyword ?? "—"}</td>
              <td>{a.updatedAt.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

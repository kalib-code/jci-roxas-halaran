import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listPlan } from "@/lib/content/seoPlan.js";
import AdminNav from "@/components/admin/AdminNav.jsx";
import { addPlanKeywordAction, setPlanStatusAction } from "./actions.js";

export const metadata = { title: "SEO plan — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function SeoPlan() {
  await requireArea("content");
  const rows = await listPlan(getDb());
  const months = [...new Set(rows.map((r) => r.month))];
  return (
    <div className="admin">
      <h1>SEO plan</h1>
      <AdminNav isAdmin />
      <div className="plan">
        {months.map((m) => {
          const items = rows.filter((r) => r.month === m);
          const done = items.filter((r) => r.status === "published").length;
          return (
            <section key={m}>
              <h2 className="syne">{m} — {done}/{items.length}</h2>
              {items.map((r) => (
                <div className="plan__card" key={r.id}>
                  <span className="k">{r.keyword}</span>
                  <span className="m">{r.volume ?? "—"} searches/mo · KD {r.kd ?? "—"}</span>
                  <span>{r.workingTitle}</span>
                  <form action={setPlanStatusAction} className="actions">
                    <input type="hidden" name="id" value={r.id} />
                    <select name="status" defaultValue={r.status} aria-label={`Status for ${r.keyword}`}>
                      <option value="idea">Idea</option><option value="drafting">Drafting</option><option value="published">Published</option>
                    </select>
                    <button className="tool" type="submit">Set</button>
                    {r.articleId ? (
                      <Link href={`/admin/articles/${r.articleId}`}>Open article</Link>
                    ) : (
                      <Link href={`/admin/articles/new?keyword=${encodeURIComponent(r.keyword)}&title=${encodeURIComponent(r.workingTitle ?? "")}`}>Write article</Link>
                    )}
                  </form>
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <form action={addPlanKeywordAction} className="editor__side">
        <h2 className="syne">Add a keyword</h2>
        <div className="field"><label htmlFor="pm">Month</label><input id="pm" name="month" placeholder="2027-02" required /></div>
        <div className="field"><label htmlFor="pk">Keyword</label><input id="pk" name="keyword" required /></div>
        <div className="field"><label htmlFor="pv">Monthly searches</label><input id="pv" name="volume" type="number" min="0" /></div>
        <div className="field"><label htmlFor="pd">Difficulty (KD)</label><input id="pd" name="kd" type="number" min="0" max="100" /></div>
        <div className="field"><label htmlFor="pt">Working title</label><input id="pt" name="workingTitle" /></div>
        <button className="btn" type="submit">Add</button>
      </form>
    </div>
  );
}

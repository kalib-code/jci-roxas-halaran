import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { monthProgress } from "@/lib/content/seoPlan.js";
import { listArticlesAdmin } from "@/lib/content/articles.js";
import { listEvents } from "@/lib/engagement/events.js";
import { safeAdminCounts } from "@/lib/admin/counts.js";
import { todoCards } from "@/lib/admin/dashboard.js";
import { formatDateTime, phNow } from "@/lib/format.js";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const QUICK = [["/admin/articles/new", "New article"], ["/admin/events/new", "New event"], ["/admin/projects/new", "Add project"], ["/admin/expenses", "Record expense"]];

export default async function Admin() {
  const { role } = await requireArea("admin");
  if (role !== "admin") {
    return (
      <div className="admin">
        <h1>Dashboard</h1>
        <p>Signed in as <strong>{role}</strong>. Only admins can edit content.</p>
      </div>
    );
  }
  const db = getDb();
  const month = phNow().slice(0, 7);
  const [progress, drafts, events, counts] = await Promise.all([
    monthProgress(db, month),
    listArticlesAdmin(db, { status: "draft" }),
    listEvents(db),
    safeAdminCounts(db),
  ]);
  const next = events.upcoming[0];
  const pct = progress.total ? Math.round((100 * progress.published) / progress.total) : 0;
  return (
    <div className="admin">
      <h1>Dashboard</h1>
      <div className="dash">
        <section className="dash__todo" aria-labelledby="todo-h">
          <h2 id="todo-h" className="syne">Things to do</h2>
          {todoCards(counts, drafts.length).map((c) => (
            <Link key={c.href} href={c.href} className="dash-card">
              <span className="dash-card__title">{c.title}</span>
              <span className="dash-card__text">{c.text}</span>
              {c.badge && <span className="admin-side__badge">{c.badge}</span>}
            </Link>
          ))}
          <Link href={next ? `/admin/events/${next.id}` : "/admin/events/new"} className="dash-card">
            <span className="dash-card__title">Next event</span>
            <span className="dash-card__text">{next ? `${next.title} · ${formatDateTime(next.startAt)} · ${next.going}${next.capacity ? ` of ${next.capacity}` : ""} going` : "No upcoming events — create one"}</span>
          </Link>
          <Link href="/admin/seo-plan" className="dash-card">
            <span className="dash-card__title">SEO plan {month}</span>
            <span className="dash-card__text">{progress.published} of {progress.total} articles published</span>
            <span className="dash-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
          </Link>
        </section>
        <section className="dash__quick" aria-labelledby="quick-h">
          <h2 id="quick-h" className="syne">Quick actions</h2>
          {QUICK.map(([href, label]) => <Link key={href} href={href} className="btn">{label}</Link>)}
        </section>
      </div>
    </div>
  );
}

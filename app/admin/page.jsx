import Link from "next/link";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { monthProgress } from "@/lib/content/seoPlan.js";
import { listArticlesAdmin } from "@/lib/content/articles.js";
import { listApplications } from "@/lib/engagement/applications.js";
import { listPayments } from "@/lib/engagement/money.js";
import { listEvents } from "@/lib/engagement/events.js";
import { formatDateTime } from "@/lib/format.js";

export const metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const thisMonth = () => new Date().toISOString().slice(0, 7);

export default async function Admin() {
  const { role } = await requireArea("admin");
  const isAdmin = role === "admin";
  const db = getDb();
  const month = thisMonth();
  const [progress, drafts, apps, pendingPayments, events] = isAdmin
    ? await Promise.all([
        monthProgress(db, month),
        listArticlesAdmin(db, { status: "draft" }),
        listApplications(db),
        listPayments(db, { status: "pending" }),
        listEvents(db),
      ])
    : [null, [], [], [], { upcoming: [] }];
  const pendingApps = apps.filter((a) => a.status === "pending").length;
  const next = events.upcoming[0];

  return (
    <div className="admin">
      <h1>Admin</h1>
      <p>Signed in as <strong>{role}</strong>.{!isAdmin && " Only admins can edit content."}</p>
      {isAdmin && (
        <>
          <section>
            <h2 className="syne">To do</h2>
            <ul>
              <li><Link href="/admin/applications">{pendingApps} pending application{pendingApps === 1 ? "" : "s"}</Link></li>
              <li><Link href="/admin/payments">{pendingPayments.length} payment{pendingPayments.length === 1 ? "" : "s"} to confirm</Link></li>
              <li>{next ? <Link href={`/admin/events/${next.id}`}>Next event: {next.title}, {formatDateTime(next.startAt)} — {next.going} going</Link> : <Link href="/admin/events/new">No upcoming events — create one</Link>}</li>
            </ul>
          </section>
          <section>
            <h2 className="syne">SEO plan {month}</h2>
            <p>{progress.published} of {progress.total} articles published. <Link href="/admin/seo-plan">Open the plan →</Link></p>
          </section>
          <section>
            <h2 className="syne">Drafts</h2>
            {drafts.length === 0 ? <p>No drafts.</p> : (
              <ul>{drafts.slice(0, 5).map((a) => <li key={a.id}><Link href={`/admin/articles/${a.id}`}>{a.title}</Link></li>)}</ul>
            )}
            <p><Link className="btn" href="/admin/articles/new">New article</Link></p>
          </section>
        </>
      )}
    </div>
  );
}

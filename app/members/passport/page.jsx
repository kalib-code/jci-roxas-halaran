import { currentMember } from "@/lib/members/current.js";
import { getDb } from "@/lib/db.js";
import { getPassport, KIND_LABELS } from "@/lib/members/passport.js";
import { formatDate } from "@/lib/format.js";
import PassportRequestForm from "@/components/members/PassportRequestForm.jsx";

export const metadata = { title: "Leadership Passport" };
export const dynamic = "force-dynamic";

export default async function Passport() {
  const { member } = await currentMember();
  if (!member) return <><h1>Leadership Passport</h1><p>Your account isn't linked to a member profile yet — ask an admin.</p></>;
  const p = await getPassport(getDb(), member.id);
  const timeline = [
    ...p.entries.map((e) => ({ key: `e${e.id}`, kind: e.kind, date: e.date, title: e.title, points: e.points, dated: true })),
    ...p.positions.map((pos) => ({ key: `p${pos.year}${pos.role}`, kind: "position", date: `${pos.year}-12-31`, title: `${pos.role} (${pos.year})`, points: 3, dated: false })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <h1>Leadership Passport</h1>
      <div className="passport-head">
        <p className="passport__points"><strong>{p.points}</strong> points</p>
        <p className="badges">{p.badges.length ? p.badges.map((b) => <span className="passport-badge" key={b.key}>{b.label}</span>) : "Your badges will appear here."}</p>
      </div>
      <section>
        <h2 className="syne">Timeline</h2>
        {timeline.length ? (
          <ol className="passport__timeline">
            {timeline.map((t) => (
              <li key={t.key}>
                <span className={`kind kind--${t.kind}`}>{KIND_LABELS[t.kind]}</span>
                <span className="t">{t.title}</span>
                <span className="y">{t.dated ? `${formatDate(t.date)} · ` : ""}{t.points} pts</span>
              </li>
            ))}
          </ol>
        ) : <p>No entries yet. Attend a project event or request your first entry below.</p>}
      </section>
      {p.pending.length > 0 && (
        <section>
          <h2 className="syne">Waiting for verification</h2>
          <ul>{p.pending.map((e) => <li key={e.id}>{KIND_LABELS[e.kind]}: {e.title} ({formatDate(e.date)})</li>)}</ul>
        </section>
      )}
      <section>
        <h2 className="syne">Request an entry</h2>
        <PassportRequestForm />
      </section>
    </>
  );
}

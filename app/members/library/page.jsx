import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listResources } from "@/lib/content/resources.js";
import { safeHttpsUrl } from "@/lib/safe.js";

export const metadata = { title: "Member library" };
export const dynamic = "force-dynamic";

const KIND_LABELS = { template: "Templates", training: "Training", bylaws: "Bylaws", other: "Other" };

export default async function Library() {
  await requireArea("members");
  const list = await listResources(getDb(), { visibility: "members" });
  const kinds = Object.keys(KIND_LABELS).filter((k) => list.some((r) => r.kind === k));
  return (
    <>
      <h1>Member library</h1>
      {list.length === 0 && <p>No members-only files yet.</p>}
      {kinds.map((k) => (
        <section key={k}>
          <h2 className="syne">{KIND_LABELS[k]}</h2>
          <div className="mlib">
            {list.filter((r) => r.kind === k).map((r) => (
              <article key={r.id} className="dash-card mlib__item">
                <span className="dash-card__title">{r.title}</span>
                {r.description && <span className="dash-card__text">{r.description}</span>}
                {safeHttpsUrl(r.fileUrl) && <a className="tool" href={safeHttpsUrl(r.fileUrl)} target="_blank" rel="noreferrer">Open</a>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

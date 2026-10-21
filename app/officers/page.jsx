import Image from "next/image";
import OfficerCard from "@/components/OfficerCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { getCurrentBoard, getPastPresidents } from "@/lib/queries.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";
import { initials } from "@/lib/format.js";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Our officers",
  description: "Meet the president and board of officers leading JCI Roxas Halaran in Roxas City, Capiz.",
  path: "/officers",
});

export default async function Officers() {
  const db = getDb();
  const board = await getCurrentBoard(db);
  const past = board.year ? await getPastPresidents(db, board.year) : [];
  const { president } = board;

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our officers", path: "/officers" }])} />
      <header className="page-hero">
        <h1>Our officers</h1>
        <p>The {board.year ?? ""} board guiding JCI Roxas Halaran's mission of developing leaders for a changing world.</p>
      </header>

      {president && (
        <section className="president section">
          <div className="president__grid">
            <div className="president__photo">
              <figure>
                {president.photoUrl ? (
                  <Image src={president.photoUrl} alt={president.name} fill sizes="380px" style={{ objectFit: "cover", objectPosition: "top" }} priority />
                ) : (
                  <div className="initials" aria-hidden="true">{initials(president.name)}</div>
                )}
              </figure>
              <span className="label label--sm">{president.name} — {board.year} Local Organization President</span>
            </div>
            <div className="president__body">
              <h2 className="syne">{president.name}</h2>
              {president.bio?.split("\n\n").map((para) => <p className="bio" key={para}>{para}</p>)}
              {president.quote && <blockquote>“{president.quote}”</blockquote>}
            </div>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section__bar"><h2>Board {board.year}</h2><span className="label">Officers</span></div>
        <div className="officers">
          {board.officers.map((o) => <OfficerCard key={`${o.slug}-${o.role}`} officer={o} />)}
        </div>
      </section>

      {past.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Past presidents</h2><span className="label">Since 2023</span></div>
          <div className="list-rows">
            {past.map((p) => (
              <div key={p.year}><span className="t">{p.name}</span><span className="y">{p.year}</span></div>
            ))}
          </div>
        </section>
      )}

      <SiteFooter />
    </>
  );
}

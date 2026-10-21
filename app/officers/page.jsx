import Image from "next/image";
import OfficerCard from "@/components/OfficerCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { getCurrentBoard, getPastPresidents, listAwards, listProjects } from "@/lib/queries.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";
import { initials } from "@/lib/format.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Our officers",
  description: "Meet the president and board of officers leading JCI Roxas Halaran in Roxas City, Capiz.",
  path: "/officers",
});

const isDirector = (role) => /director/i.test(role);

// Awards whose title names this person, e.g. "Star President — Lemuel Capa".
function awardsFor(name, awards) {
  const words = name.split(/\s+/).filter((w) => w.replace(/\./g, "").length > 1 && !/^(jr|sr|ii|iii)\.?$/i.test(w));
  const [first, last] = [words[0], words.at(-1)];
  return awards.filter((a) => a.title.includes(first) && a.title.includes(last));
}

export default async function Officers() {
  const db = getDb();
  const [board, awards, projects] = await Promise.all([getCurrentBoard(db), listAwards(db), listProjects(db)]);
  const past = board.year ? await getPastPresidents(db, board.year) : [];
  const { president } = board;
  const executive = board.officers.filter((o) => !isDirector(o.role));
  const directors = board.officers.filter((o) => isDirector(o.role));
  const yearAwards = awards.filter((a) => a.year === board.year);
  const yearProjects = projects.filter((p) => p.status === "done" && p.startDate?.startsWith(String(board.year))).length;

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
            <figure className="president__photo">
              {president.photoUrl ? (
                <Image src={president.photoUrl} alt={president.name} fill sizes="(max-width: 900px) 80vw, 380px" style={{ objectFit: "cover", objectPosition: "top" }} priority />
              ) : (
                <div className="initials" aria-hidden="true">{initials(president.name)}</div>
              )}
            </figure>
            <div className="president__body">
              <span className="label">{board.year} Local Organization President</span>
              <h2 className="president__name">{president.name}</h2>
              {president.bio?.split("\n\n").map((para) => <p className="bio" key={para}>{para}</p>)}
              {president.quote && <blockquote>“{president.quote}”</blockquote>}
              {(yearAwards.length > 0 || yearProjects > 0) && (
                <div className="president__year">
                  <span className="label">This year's highlights</span>
                  <ul>
                    {yearProjects > 0 && <li><strong>{yearProjects}</strong> projects completed in {board.year}</li>}
                    {yearAwards.map((a) => <li key={a.id}>{a.title} <span>· {a.awardedBy}</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {executive.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Executive committee</h2><span className="label">{board.year}</span></div>
          <div className="officers">
            {executive.map((o) => <OfficerCard key={`${o.slug}-${o.role}`} officer={o} />)}
          </div>
        </section>
      )}

      {directors.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Directors</h2><span className="label">{board.year}</span></div>
          <div className="officers officers--compact">
            {directors.map((o) => <OfficerCard key={`${o.slug}-${o.role}`} officer={o} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Past presidents</h2><span className="label">Since 2023</span></div>
          <ul className="past-presidents">
            {past.map((p) => {
              const honors = awardsFor(p.name, awards);
              return (
                <li key={p.year} className="past-president">
                  <span className="past-president__photo">
                    {p.photoUrl ? <Image src={p.photoUrl} alt="" fill sizes="64px" style={{ objectFit: "cover", objectPosition: "top" }} /> : <span aria-hidden="true">{initials(p.name)}</span>}
                  </span>
                  <span className="past-president__body">
                    <span className="past-president__name">{p.name}</span>
                    {honors.length > 0 && <span className="past-president__honors">{honors.map((a) => `${a.title.split(" — ")[0]} ${a.year}`).join(" · ")}</span>}
                  </span>
                  <span className="past-president__year">{p.year}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <SiteFooter />
    </>
  );
}

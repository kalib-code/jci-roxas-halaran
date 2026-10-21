import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listAwards, listSponsors } from "@/lib/queries.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "About us",
  description: "Who we are: JCI Roxas Halaran's mission, vision, values, recognition and partners in Roxas City, Capiz.",
  path: "/about",
});

export default async function About() {
  const db = getDb();
  const [awards, sponsors] = await Promise.all([listAwards(db), listSponsors(db)]);

  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "About us", path: "/about" }])} />
      <header className="page-hero">
        <h1>About JCI Roxas Halaran</h1>
        <p>A Capiz-based chapter of Junior Chamber International, the worldwide organization of young active citizens aged 18 to 40, active in Roxas City since {SITE.foundedYear}.</p>
      </header>

      <section className="section">
        <div className="about__grid">
          <h2>Mission</h2>
          <p>{SITE.mission}</p>
          <h2>Vision</h2>
          <p>{SITE.vision}</p>
        </div>
      </section>

      <section className="section section--line-top">
        <div className="stats">
          {SITE.stats.map((s) => (
            <div className="stat" key={s.label}>
              <span className="v">{s.value}</span>
              <span className="l">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section__bar"><h2>Recognition</h2><span className="label">Awards</span></div>
        {awards.map((a) => (
          <div className="award" key={a.title}>
            <span className="t">{a.title}</span>
            <span className="by">{a.awardedBy}</span>
            <span className="y">{a.year}</span>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section__bar"><h2>Partners</h2><span className="label">Thank you</span></div>
        <div className="list-rows">
          {sponsors.map((s) => (
            <div key={s.name}><span className="t">{s.name}</span></div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

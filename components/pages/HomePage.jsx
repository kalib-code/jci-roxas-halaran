import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import ProjectCard from "@/components/ProjectCard.jsx";
import ArticleCard from "@/components/ArticleCard.jsx";
import EventRow from "@/components/EventRow.jsx";
import CountUp from "@/components/CountUp.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects, listAwards, getCurrentBoard } from "@/lib/queries.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { listEvents } from "@/lib/engagement/events.js";
import { impactTotals, impactStats } from "@/lib/proof/impact.js";
import { organizationLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";
import { t, pathFor } from "@/lib/i18n.js";

// The figures a first-time visitor should see first, in this order.
const HEADLINE_STATS = ["Projects completed", "People reached", "Trees planted", "Volunteers", "Barangays served", "Schools"];

export default async function HomePage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const db = getDb();
  const [projects, awards, latest, events, totals, board] = await Promise.all([
    listProjects(db),
    listAwards(db),
    listPublishedArticles(db, { limit: 3 }),
    listEvents(db),
    impactTotals(db),
    getCurrentBoard(db),
  ]);
  const [based, place] = L("home.metaBased").split(/, (?=Capiz)/);
  const recent = projects.filter((p) => p.coverUrl && p.status === "done").slice(0, 6);
  const stats = impactStats(totals).sort(([a], [b]) => rank(a) - rank(b)).slice(0, 4);
  const newestYear = awards[0]?.year;
  const recognition = awards.filter((a) => a.year === newestYear).slice(0, 6);
  const president = board.president;

  return (
    <div lang={lang === "hil" ? "hil" : undefined}>
      <JsonLd data={organizationLd()} />

      <header className="hero">
        <Contours variant="hero" />
        <div className="hero__inner">
          <h1 className="hero__title">JCI Roxas<br />Halaran<em>.</em></h1>
          <p className="hero__statement">{L("home.statement")}</p>
          <div className="hero__meta">
            <span>{based},<br />{place}</span>
            <span>{L("home.metaSince")}</span>
            {president && <span>{board.year} {L("home.metaPresident")}<br />{president.name}</span>}
            <span className="hero__actions">
              <Link className="btn" href={pathFor(lang, "/join")}>{L("cta.member")}</Link>
              <Link className="btn btn--ghost" href="/impact">{L("cta.impact")}</Link>
            </span>
          </div>
        </div>
      </header>

      {stats.length > 0 && (
        <section className="section section--line-bottom" aria-labelledby="impact-title">
          <div className="section__bar">
            <h2 id="impact-title">{L("home.impactTitle")}</h2>
            <span className="label">{L("home.impactEnd")}</span>
          </div>
          <div className="stats">
            {stats.map(([label, value]) => (
              <div className="stat" key={label} lang="en">
                <CountUp value={value} />
                <span className="l">{label}</span>
              </div>
            ))}
          </div>
          <p className="section__more"><Link href="/impact">{L("home.mapLink")}</Link></p>
        </section>
      )}

      <section id="projects" className="section">
        <div className="section__bar">
          <h2>{L("home.projectsTitle")}</h2>
          <span className="label">{L("home.projectsLabel")}</span>
        </div>
        <div className="projects">
          {recent.map((p) => <ProjectCard key={p.slug} project={p} />)}
        </div>
        <p className="section__more"><Link className="btn" href="/projects">{L("home.projectsMore")}</Link></p>
      </section>

      {recognition.length > 0 && (
        <section className="section section--line-top" aria-labelledby="awards-title">
          <div className="section__bar">
            <h2 id="awards-title">{L("home.awardsTitle")}</h2>
            <span className="label">{newestYear}</span>
          </div>
          <ul className="honors">
            {recognition.map((a) => (
              <li className="honor" key={a.id} lang="en">
                <span className="honor__title">{a.title}</span>
                <span className="honor__by">{a.awardedBy}</span>
              </li>
            ))}
          </ul>
          <p className="section__more"><Link href="/about">{L("home.awardsLink")}</Link></p>
        </section>
      )}

      {president && (
        <section className="section leader" aria-labelledby="leader-title">
          {president.photoUrl && (
            <figure className="leader__photo">
              <Image src={president.photoUrl} alt={president.name} fill sizes="(max-width: 900px) 60vw, 320px" style={{ objectFit: "cover" }} />
            </figure>
          )}
          <div className="leader__body">
            <span className="label">{board.year} · {L("home.presidentRole")}</span>
            <h2 id="leader-title" className="leader__name">{president.name}</h2>
            {president.quote && <blockquote className="leader__quote">{president.quote}</blockquote>}
            <p>{L("home.boardBody")}</p>
            <p><Link className="btn btn--ghost" href="/officers">{L("home.boardLink")}</Link></p>
          </div>
        </section>
      )}

      {events.upcoming.length > 0 && (
        <section className="section">
          <div className="section__bar">
            <h2>{L("home.eventsTitle")}</h2>
            <span className="label">RSVP</span>
          </div>
          <div className="agenda">{events.upcoming.slice(0, 3).map((e) => <EventRow key={e.id} event={e} />)}</div>
          <p className="section__more"><Link className="btn" href={pathFor(lang, "/events")}>{L("home.eventsMore")}</Link></p>
        </section>
      )}

      {latest.length > 0 && (
        <section className="section">
          <div className="section__bar">
            <h2>{L("home.blogTitle")}</h2>
            <span className="label">{L("home.blogLabel")}</span>
          </div>
          <div className="projects">{latest.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
          <p className="section__more"><Link className="btn" href="/articles">{L("home.blogMore")}</Link></p>
        </section>
      )}

      <section className="dune section">
        <div className="dune__grid">
          <div className="dune__col">
            <span className="label">{L("home.since")} {SITE.foundedYear}</span>
            <p className="dune__lede">{L("home.history")}</p>
            <p>{L("home.aboutBody")}</p>
            <p className="dune__note"><Link href="/about">{L("home.storyLink")}</Link></p>
          </div>
          <div className="dune__photo">
            <Image src={HOME_PHOTO} alt={L("home.photoAlt")} fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </section>

      <section className="quote">
        <Contours variant="quote" />
        <div className="quote__inner">
          <span className="label">{L("home.goalLabel")}</span>
          <p className="quote__text">{L("home.joinTitle")}</p>
          <p className="quote__cta"><Link className="btn btn--lg" href={pathFor(lang, "/join")}>{L("cta.member")}</Link></p>
        </div>
      </section>

      <SiteFooter lang={lang} altHref={lang === "hil" ? "/" : "/hil"} />
    </div>
  );
}

// A real chapter photo from Bags of Hope 2026, in place of the old stock image.
const HOME_PHOTO = "/assets/img/projects/bags-of-hope-2026.jpg";

const rank = (label) => {
  const i = HEADLINE_STATS.indexOf(label);
  return i === -1 ? HEADLINE_STATS.length : i;
};

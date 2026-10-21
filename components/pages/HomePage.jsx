import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import ProjectCard from "@/components/ProjectCard.jsx";
import ArticleCard from "@/components/ArticleCard.jsx";
import EventCard from "@/components/EventCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects, listAwards } from "@/lib/queries.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { listEvents } from "@/lib/engagement/events.js";
import { impactTotals, homeStats } from "@/lib/proof/impact.js";
import { organizationLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";
import { t, pathFor } from "@/lib/i18n.js";

export default async function HomePage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const db = getDb();
  const [projects, awards, latest, events, totals] = await Promise.all([
    listProjects(db, { limit: 3 }),
    listAwards(db),
    listPublishedArticles(db, { limit: 3 }),
    listEvents(db),
    impactTotals(db),
  ]);
  const [based, place] = L("home.metaBased").split(/, (?=Capiz)/);

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
            <span>{L("home.metaJci")}</span>
            <span>{L("home.metaPillars")}</span>
            <Link className="btn" href={pathFor(lang, "/join")}>{L("cta.member")}</Link>
          </div>
        </div>
      </header>

      <section id="about" className="section section--line-top">
        <div className="crumbs label">
          <span className="num">01</span><span className="mid">{L("home.aboutLabel")}</span><span className="end">{SITE.name}</span>
        </div>
        <div className="about__grid">
          <h2>{L("home.aboutTitle")}</h2>
          <p>{L("home.aboutBody")}</p>
        </div>
        <div className="pillars">
          {SITE.pillars.map((p) => (
            <div className="pillar" key={p.num} lang="en">
              <span className="num">{p.num}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="projects" className="section">
        <div className="section__bar">
          <h2>{L("home.projectsTitle")}</h2>
          <span className="label">{L("home.projectsLabel")}</span>
        </div>
        <div className="projects">
          {projects.map((p) => <ProjectCard key={p.slug} project={p} />)}
        </div>
        <p className="section__more"><Link className="btn" href="/projects">{L("home.projectsMore")}</Link></p>
      </section>

      {events.upcoming.length > 0 && (
        <section className="section">
          <div className="section__bar">
            <h2>{L("home.eventsTitle")}</h2>
            <span className="label">RSVP</span>
          </div>
          <div className="projects">{events.upcoming.slice(0, 3).map((e) => <EventCard key={e.id} event={e} />)}</div>
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

      <section className="quote">
        <Contours variant="quote" />
        <div className="quote__inner">
          <span className="label">{L("home.goalLabel")}</span>
          <p className="quote__text">{L("home.quote")}</p>
        </div>
      </section>

      <section className="section section--line-bottom">
        <div className="crumbs label">
          <span className="num">04</span><span className="mid">{L("home.impactLabel")}</span><span className="end">{L("home.impactEnd")}</span>
        </div>
        <div className="stats">
          {homeStats(totals, SITE.stats).map((s) => (
            <div className="stat" key={s.label} lang="en">
              <span className="v">{s.value}</span>
              <span className="l">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="stats__mission">{L("home.mission")} <span lang="en">{SITE.mission}</span></p>
      </section>

      <section className="dune section">
        <div className="dune__grid">
          <div className="dune__col">
            <span className="label">{L("home.since")} {SITE.foundedYear}</span>
            <p className="dune__lede">{L("home.history")}</p>
            <div className="dune__stats">
              {awards.slice(0, 2).map((a) => (
                <div className="dune__stat" key={a.id}>
                  <span className="v">{a.year}</span>
                  <span className="l" lang="en">{a.title}</span>
                </div>
              ))}
            </div>
            <p className="dune__note"><Link href="/about">{L("home.storyLink")}</Link></p>
          </div>
          <div className="dune__photo">
            <Image src={SITE.aboutPhoto} alt={L("home.photoAlt")} fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </section>

      <SiteFooter lang={lang} altHref={lang === "hil" ? "/" : "/hil"} />
    </div>
  );
}

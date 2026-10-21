import Link from "next/link";
import EventRow from "@/components/EventRow.jsx";
import ProjectCard from "@/components/ProjectCard.jsx";
import Contours from "@/components/Contours.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listEvents } from "@/lib/engagement/events.js";
import { listProjects } from "@/lib/queries.js";
import { groupByMonth } from "@/lib/eventDates.js";
import { breadcrumbLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";
import { t, pathFor } from "@/lib/i18n.js";

export default async function EventsPage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const db = getDb();
  const { upcoming, past } = await listEvents(db);
  // With nothing scheduled, show recent work so the page still proves the chapter is active.
  const recent = upcoming.length === 0 ? (await listProjects(db)).filter((p) => p.coverUrl && p.status === "done").slice(0, 3) : [];
  return (
    <div lang={lang === "hil" ? "hil" : undefined}>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: pathFor(lang, "/") }, { name: L("events.title"), path: pathFor(lang, "/events") }])} />
      <header className="page-hero">
        <h1>{L("events.title")}</h1>
        <p>{L("events.intro")}</p>
      </header>

      <section className="section">
        <div className="section__bar"><h2>{L("events.upcoming")}</h2><span className="label">{L("events.rsvpLabel")}</span></div>
        {upcoming.length === 0 ? (
          <div className="events-empty">
            <Contours variant="quote" />
            <div className="events-empty__inner">
              <p className="events-empty__title">{L("events.noneTitle")}</p>
              <p>{L("events.none")}</p>
              <p className="events-empty__actions">
                <a className="btn" href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">{L("events.followFacebook")}</a>
                <Link className="btn btn--ghost" href="/projects">{L("events.seeWork")}</Link>
              </p>
            </div>
          </div>
        ) : (
          groupByMonth(upcoming).map((g) => (
            <div className="agenda" key={g.key}>
              <h3 className="agenda__month label">{g.label}</h3>
              {g.events.map((e) => <EventRow key={e.id} event={e} />)}
            </div>
          ))
        )}
      </section>

      {recent.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>{L("events.recentWork")}</h2><span className="label">{L("home.projectsLabel")}</span></div>
          <div className="projects">{recent.map((p) => <ProjectCard key={p.slug} project={p} />)}</div>
        </section>
      )}

      {past.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>{L("events.past")}</h2><span className="label">{L("events.archive")}</span></div>
          <div className="agenda">{past.slice(0, 8).map((e) => <EventRow key={e.id} event={e} past />)}</div>
        </section>
      )}
      <SiteFooter lang={lang} altHref={lang === "hil" ? "/events" : "/hil/events"} />
    </div>
  );
}

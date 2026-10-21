import EventCard from "@/components/EventCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listEvents } from "@/lib/engagement/events.js";
import { breadcrumbLd } from "@/lib/seo.js";
import { t, pathFor } from "@/lib/i18n.js";

export default async function EventsPage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const { upcoming, past } = await listEvents(getDb());
  return (
    <div lang={lang === "hil" ? "hil" : undefined}>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: pathFor(lang, "/") }, { name: L("events.title"), path: pathFor(lang, "/events") }])} />
      <header className="page-hero">
        <h1>{L("events.title")}</h1>
        <p>{L("events.intro")}</p>
      </header>
      <section className="section">
        <div className="section__bar"><h2>{L("events.upcoming")}</h2><span className="label">{L("events.rsvpLabel")}</span></div>
        {upcoming.length === 0 ? <p>{L("events.none")}</p> : (
          <div className="projects">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
        )}
      </section>
      {past.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>{L("events.past")}</h2><span className="label">{L("events.archive")}</span></div>
          <div className="projects">{past.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}
      <SiteFooter lang={lang} altHref={lang === "hil" ? "/events" : "/hil/events"} />
    </div>
  );
}

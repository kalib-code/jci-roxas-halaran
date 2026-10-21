import EventCard from "@/components/EventCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listEvents } from "@/lib/engagement/events.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Events",
  description: "Upcoming JCI Roxas Halaran events in Roxas City, Capiz: trainings, community projects and general assemblies. RSVP online.",
  path: "/events",
});

export default async function Events() {
  const { upcoming, past } = await listEvents(getDb());
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Events", path: "/events" }])} />
      <header className="page-hero">
        <h1>Events</h1>
        <p>Join us at our next training, project or assembly. Most events are open to guests.</p>
      </header>
      <section className="section">
        <div className="section__bar"><h2>Upcoming</h2><span className="label">RSVP online</span></div>
        {upcoming.length === 0 ? <p>New events are coming soon — follow our Facebook page for announcements.</p> : (
          <div className="projects">{upcoming.map((e) => <EventCard key={e.id} event={e} />)}</div>
        )}
      </section>
      {past.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Past events</h2><span className="label">Archive</span></div>
          <div className="projects">{past.slice(0, 6).map((e) => <EventCard key={e.id} event={e} />)}</div>
        </section>
      )}
      <SiteFooter />
    </>
  );
}

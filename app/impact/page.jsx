import Link from "next/link";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import ImpactMap from "@/components/ImpactMap.jsx";
import { getDb } from "@/lib/db.js";
import { impactTotals, impactStats, mapProjects, projectsByBarangay } from "@/lib/proof/impact.js";
import Contours from "@/components/Contours.jsx";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Our impact in Capiz",
  description: "Where JCI Roxas Halaran works across Capiz and what our projects have achieved: projects, volunteers, people reached and more.",
  path: "/impact",
});

export default async function Impact() {
  const db = getDb();
  const [totals, points, groups] = await Promise.all([impactTotals(db), mapProjects(db), projectsByBarangay(db)]);
  const stats = impactStats(totals);
  const projectCount = groups.reduce((n, g) => n + g.projects.length, 0);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our impact", path: "/impact" }])} />
      <header className="page-hero">
        <h1>Our impact in Capiz</h1>
        <p>Where we work and what our projects have achieved, updated as each project is recorded.</p>
      </header>
      {stats.length > 0 && (
        <section className="section">
          <div className="stats">
            {stats.map(([label, value]) => (
              <div className="stat" key={label}>
                <span className="v">{value.toLocaleString("en-PH")}</span>
                <span className="l">{label}</span>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="section section--line-top">
        <div className="section__bar"><h2>Project map</h2><span className="label">Capiz</span></div>
        {points.length ? <ImpactMap points={points} /> : (
          <div className="map-empty">
            <Contours variant="quote" />
            <p><strong>{projectCount} projects</strong> are being mapped.</p>
            <a href="#by-place">See them by place</a>
          </div>
        )}
      </section>
      <section className="section" id="by-place">
        <div className="section__bar"><h2>Projects by place</h2><span className="label">List</span></div>
        <div className="impact-groups">
          {groups.map((g) => (
            <div key={g.barangay} className="impact-group">
              <h3 className="syne">{g.barangay}</h3>
              <ul className="impact-list">{g.projects.map((p) => <li key={p.id}><Link href={`/projects/${p.slug}`}>{p.title}</Link></li>)}</ul>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </>
  );
}

import Link from "next/link";
import ProjectCard, { PILLARS } from "@/components/ProjectCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Our projects",
  description: "Community projects by JCI Roxas Halaran across Roxas City and Capiz: leadership, community development and global outreach.",
  path: "/projects",
});

// Projects arrive newest first, so years come out in order too.
function byYear(projects) {
  const groups = new Map();
  for (const p of projects) {
    const year = p.startDate?.slice(0, 4) ?? "Undated";
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(p);
  }
  return [...groups];
}

export default async function Projects({ searchParams }) {
  const { pillar } = await searchParams;
  const active = PILLARS[pillar] ? pillar : undefined;
  const all = await listProjects(getDb());
  const projects = active ? all.filter((p) => p.pillar === active) : all;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our projects", path: "/projects" }])} />
      <header className="page-hero">
        <h1>Our projects</h1>
        <p>How the chapter turns local needs into lasting action across Roxas City and Capiz.</p>
      </header>
      <section className="section">
        <nav className="chips" aria-label="Filter by pillar">
          <Link href="/projects" aria-current={active ? undefined : "page"}>All</Link>
          {Object.entries(PILLARS).map(([key, label]) => (
            <Link key={key} href={`/projects?pillar=${key}`} aria-current={active === key ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        {projects.length === 0 && <p>No projects here yet.</p>}
        {byYear(projects).map(([year, list]) => (
          <section key={year} className="year-group" aria-labelledby={`y-${year}`}>
            <h2 id={`y-${year}`} className="year-group__head">{year} <span>{list.length} {list.length === 1 ? "project" : "projects"}</span></h2>
            <div className="article-grid">{list.map((p) => <ProjectCard key={p.slug} project={p} />)}</div>
          </section>
        ))}
      </section>
      <SiteFooter />
    </>
  );
}

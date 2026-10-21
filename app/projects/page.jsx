import ProjectCard from "@/components/ProjectCard.jsx";
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

export default async function Projects() {
  const projects = await listProjects(getDb());
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our projects", path: "/projects" }])} />
      <header className="page-hero">
        <h1>Our projects</h1>
        <p>How the chapter turns local needs into lasting action across Roxas City and Capiz.</p>
      </header>
      <section className="section">
        <div className="projects">
          {projects.map((p) => <ProjectCard key={p.slug} project={p} />)}
        </div>
      </section>
      <SiteFooter />
    </>
  );
}

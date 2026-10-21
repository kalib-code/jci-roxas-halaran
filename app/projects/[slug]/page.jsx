import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { getProjectBySlug } from "@/lib/content/projects.js";
import { listArticlesForProject } from "@/lib/content/articles.js";
import { formatDate } from "@/lib/format.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return (await listProjects(getDb())).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const project = await getProjectBySlug(getDb(), slug);
  if (!project) return { title: "Page not found", robots: { index: false } };
  return pageMetadata({
    title: project.title,
    description: project.summary ?? `${project.title}, a JCI Roxas Halaran project in Roxas City, Capiz.`,
    path: `/projects/${slug}`,
  });
}

export default async function ProjectPage({ params }) {
  const { slug } = await params;
  const db = getDb();
  const project = await getProjectBySlug(db, slug);
  if (!project) notFound();
  const stories = await listArticlesForProject(db, project.id);
  const date = formatDate(project.startDate);
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our projects", path: "/projects" }, { name: project.title, path: `/projects/${slug}` }])} />
      <header className="page-hero">
        <p className="label">{[date, project.barangay].filter(Boolean).join(" · ") || "Project"}</p>
        <h1>{project.title}</h1>
        {project.summary && <p>{project.summary}</p>}
      </header>
      {project.coverUrl && (
        <figure className="article__cover">
          <Image src={project.coverUrl} alt={project.coverAlt ?? project.title} fill sizes="100vw" style={{ objectFit: "cover" }} priority />
        </figure>
      )}
      <section className="section">
        {project.body ? <div className="article-body" dangerouslySetInnerHTML={{ __html: project.body }} /> : <p>The full story of this project is coming soon.</p>}
      </section>
      {project.photos.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Gallery</h2><span className="label">Photos</span></div>
          <div className="projects">
            {project.photos.map((p) => (
              <figure className="gallery__item" key={p.id}>
                <Image src={p.url} alt={p.alt} fill sizes="(max-width: 900px) 100vw, 33vw" style={{ objectFit: "cover" }} />
              </figure>
            ))}
          </div>
        </section>
      )}
      {stories.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Stories about this project</h2><span className="label">Articles</span></div>
          <div className="projects">{stories.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
        </section>
      )}
      <p className="section"><Link className="btn" href="/projects">All projects</Link></p>
      <SiteFooter />
    </>
  );
}

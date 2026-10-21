import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleCard from "@/components/ArticleCard.jsx";
import { PILLARS } from "@/components/ProjectCard.jsx";
import { SafeHtml } from "@/components/SafeHtml.jsx";
import ProgressBar from "@/components/ProgressBar.jsx";
import ProjectMedia from "@/components/ProjectMedia.jsx";
import VolunteerForm from "@/components/forms/VolunteerForm.jsx";
import { getCampaignForProject } from "@/lib/engagement/money.js";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects } from "@/lib/queries.js";
import { getProjectBySlug } from "@/lib/content/projects.js";
import { listArticlesForProject } from "@/lib/content/articles.js";
import { formatDate } from "@/lib/format.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

const STATUS = { planned: "Planned", ongoing: "Ongoing", done: "Completed" };

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
  const [stories, campaign] = await Promise.all([listArticlesForProject(db, project.id), getCampaignForProject(db, project.id)]);
  const pillar = PILLARS[project.pillar] ? project.pillar : "community";
  const start = formatDate(project.startDate);
  const end = project.endDate && project.endDate !== project.startDate ? formatDate(project.endDate) : null;
  const when = start && end ? `${start} – ${end}` : start;
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Our projects", path: "/projects" }, { name: project.title, path: `/projects/${slug}` }])} />
      <header className="article__head">
        <p className="acard__cat">
          <Link href="/projects">Projects</Link> / <Link href={`/projects?pillar=${pillar}`}>{PILLARS[pillar]}</Link>
        </p>
        <h1>{project.title}</h1>
        {project.summary && <p className="article__dek">{project.summary}</p>}
      </header>
      {project.coverUrl && (
        <figure className="article__cover article__cover--contained">
          <Image src={project.coverUrl} alt={project.coverAlt ?? project.title} fill sizes="(max-width: 1200px) 100vw, 1100px" style={{ objectFit: "cover" }} priority />
        </figure>
      )}
      <div className="article__layout article__layout--facts">
        <aside className="facts" aria-label="Project facts">
          <dl>
            {when && <div><dt>When</dt><dd>{when}</dd></div>}
            {project.barangay && <div><dt>Where</dt><dd>{project.barangay}</dd></div>}
            <div><dt>Pillar</dt><dd>{PILLARS[pillar]}</dd></div>
            <div><dt>Status</dt><dd>{STATUS[project.status] ?? STATUS.done}</dd></div>
          </dl>
          {campaign && (
            <div className="facts__campaign">
              <p className="acard__cat">{campaign.title}</p>
              <ProgressBar raisedCentavos={campaign.raisedCentavos} goalCentavos={campaign.goalCentavos} label={campaign.title} />
              <Link className="btn" href={`/support#${campaign.slug}`}>Donate</Link>
            </div>
          )}
          <a className="btn btn--ghost" href="#volunteer">Volunteer</a>
        </aside>
        <div className="article__main">
          {project.body ? <SafeHtml className="article-body" html={project.body} /> : <p>The full story of this project is coming soon.</p>}
        </div>
      </div>
      <ProjectMedia items={project.media} />
      {project.photos.length > 0 && (
        <section className="section">
          <div className="section__bar"><h2>Gallery</h2><span className="label">Photos</span></div>
          <div className="article-grid article-grid--gallery">
            {project.photos.map((p) => (
              <figure className="acard__media" key={p.id}>
                <Image src={p.url} alt={p.alt} fill sizes="(max-width: 900px) 50vw, 33vw" style={{ objectFit: "cover" }} />
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
      <section className="section section--line-top volunteer" id="volunteer">
        <div>
          <h2>Volunteer</h2>
          <p>Want to help with {project.title} or the next one like it? Leave your details and a chapter officer will reach out.</p>
          <p><Link href="/projects">← All projects</Link></p>
        </div>
        <VolunteerForm projectId={project.id} />
      </section>
      <SiteFooter />
    </>
  );
}

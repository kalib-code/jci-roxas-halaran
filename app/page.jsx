import Link from "next/link";
import Image from "next/image";
import Contours from "@/components/Contours.jsx";
import ProjectCard from "@/components/ProjectCard.jsx";
import ArticleCard from "@/components/ArticleCard.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listProjects, listAwards } from "@/lib/queries.js";
import { listPublishedArticles } from "@/lib/content/articles.js";
import { pageMetadata, organizationLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: { absolute: "JCI Roxas Halaran | Leadership & Entrepreneurship in Roxas City, Capiz" },
  description: SITE.description,
  path: "/",
});

export default async function Home() {
  const db = getDb();
  const [projects, awards, latest] = await Promise.all([
    listProjects(db, { limit: 3 }),
    listAwards(db),
    listPublishedArticles(db, { limit: 3 }),
  ]);

  return (
    <>
      <JsonLd data={organizationLd()} />

      <header className="hero">
        <Contours variant="hero" />
        <div className="hero__inner">
          <h1 className="hero__title">JCI Roxas<br />Halaran<em>.</em></h1>
          <p className="hero__statement">Our offering to Capiz: young leaders turning local needs into lasting action.</p>
          <div className="hero__meta">
            <span>Based in Roxas City,<br />Capiz, 5800</span>
            <span>Part of JCI,<br />in 100+ countries</span>
            <span>Leadership<br />Entrepreneurship</span>
            <Link className="btn" href="/join">Become a Member →</Link>
          </div>
        </div>
      </header>

      <section id="about" className="section section--line-top">
        <div className="crumbs label">
          <span className="num">01</span><span className="mid">About Us</span><span className="end">{SITE.name}</span>
        </div>
        <div className="about__grid">
          <h2>We are a Capiz-based JCI chapter</h2>
          <p>Connecting members worldwide through shared values and empowering them to create positive change and opportunities on a global scale.</p>
        </div>
        <div className="pillars">
          {SITE.pillars.map((p) => (
            <div className="pillar" key={p.num}>
              <span className="num">{p.num}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="projects" className="section">
        <div className="section__bar">
          <h2>Stories from our projects</h2>
          <span className="label">02 — Projects</span>
        </div>
        <div className="projects">
          {projects.map((p) => <ProjectCard key={p.slug} project={p} />)}
        </div>
        <p className="section__more"><Link className="btn" href="/projects">See all projects</Link></p>
      </section>

      {latest.length > 0 && (
        <section className="section">
          <div className="section__bar">
            <h2>From the blog</h2>
            <span className="label">Articles</span>
          </div>
          <div className="projects">{latest.map((a) => <ArticleCard key={a.id} article={a} />)}</div>
          <p className="section__more"><Link className="btn" href="/articles">All articles</Link></p>
        </section>
      )}

      <section className="quote">
        <Contours variant="quote" />
        <div className="quote__inner">
          <span className="label">03 — Our Goal</span>
          <p className="quote__text">Great leaders don't set out to be a leader… they set out to make a difference.</p>
        </div>
      </section>

      <section className="section section--line-bottom">
        <div className="crumbs label">
          <span className="num">04</span><span className="mid">Impact</span><span className="end">In numbers</span>
        </div>
        <div className="stats">
          {SITE.stats.map((s) => (
            <div className="stat" key={s.label}>
              <span className="v">{s.value}</span>
              <span className="l">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="stats__mission">Our mission: {SITE.mission}</p>
      </section>

      <section className="dune section">
        <div className="dune__grid">
          <div className="dune__col">
            <span className="label">05 — Since {SITE.foundedYear}</span>
            <p className="dune__lede">The Philippine Jaycees, now JCI Philippines, is the first nationally organized leadership development organization in Asia. JCI Roxas Halaran carries that tradition into Capiz.</p>
            <div className="dune__stats">
              {awards.slice(0, 2).map((a) => (
                <div className="dune__stat" key={a.title}>
                  <span className="v">{a.year}</span>
                  <span className="l">{a.title}</span>
                </div>
              ))}
            </div>
            <p className="dune__note"><Link href="/about">Our story and recognition →</Link></p>
          </div>
          <div className="dune__photo">
            <Image src={SITE.aboutPhoto} alt="JCI Roxas Halaran members at a chapter activity" fill sizes="(max-width: 900px) 100vw, 50vw" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}

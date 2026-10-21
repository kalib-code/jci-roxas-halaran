import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listResources } from "@/lib/content/resources.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Free resources",
  description: "Free templates from JCI Roxas Halaran: project proposal, sponsorship letter, event proposal and more.",
  path: "/resources",
});

const KIND_LABELS = { template: "Templates", training: "Training", bylaws: "Bylaws", other: "Other" };

export default async function Resources() {
  const list = await listResources(getDb(), { visibility: "public" });
  const kinds = Object.keys(KIND_LABELS).filter((k) => list.some((r) => r.kind === k));
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Free resources", path: "/resources" }])} />
      <header className="page-hero">
        <h1>Free resources</h1>
        <p>Templates and guides you can download and use for your own community projects.</p>
      </header>
      <section className="section">
        {list.length === 0 && <p>Resources are coming soon.</p>}
        {kinds.map((k) => (
          <div key={k}>
            <div className="section__bar"><h2>{KIND_LABELS[k]}</h2><span className="label">Download</span></div>
            <div className="list-rows">
              {list.filter((r) => r.kind === k).map((r) => (
                <div key={r.id}>
                  <span><span className="t">{r.title}</span>{r.description && <><br />{r.description}</>}</span>
                  <a className="btn" href={r.fileUrl} target="_blank" rel="noreferrer">Download</a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <SiteFooter />
    </>
  );
}

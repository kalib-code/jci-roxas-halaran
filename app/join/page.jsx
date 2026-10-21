import FaqList from "@/components/FaqList.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listFaqs } from "@/lib/queries.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";

export const revalidate = 300;

export const metadata = pageMetadata({
  title: "Become a member",
  description: "Join JCI Roxas Halaran: who can join, membership benefits, fees and how to contact us in Roxas City, Capiz.",
  path: "/join",
});

export default async function Join() {
  const faqs = await listFaqs(getDb());
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Become a member", path: "/join" }])} />
      <header className="page-hero">
        <h1>Become a member</h1>
        <p>Join a worldwide network of young active citizens aged 18 to 40 creating positive change, starting right here in Roxas City.</p>
      </header>

      <section id="contact" className="section">
        <div className="section__bar"><h2>Get in touch</h2><span className="label">Contact</span></div>
        <div className="contact">
          <div><span className="l">Email</span><a href={`mailto:${SITE.email}`}>{SITE.email}</a></div>
          <div><span className="l">Facebook</span><a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">Message our page</a></div>
          <div><span className="l">Location</span><span>{SITE.address.locality}, {SITE.address.region} {SITE.address.postalCode}</span></div>
        </div>
      </section>

      <section id="faq" className="dune section">
        <div className="faq__grid">
          <div className="faq__head">
            <span className="label">FAQ</span>
            <h2>Frequently asked questions</h2>
          </div>
          <FaqList faqs={faqs} />
        </div>
      </section>

      <SiteFooter cta={false} />
    </>
  );
}

import Link from "next/link";
import FaqList from "@/components/FaqList.jsx";
import ApplicationForm from "@/components/forms/ApplicationForm.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import { getDb } from "@/lib/db.js";
import { listFaqs } from "@/lib/queries.js";
import { breadcrumbLd } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";
import { t, pathFor } from "@/lib/i18n.js";

export default async function JoinPage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const faqs = await listFaqs(getDb());
  return (
    <div lang={lang === "hil" ? "hil" : undefined}>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: pathFor(lang, "/") }, { name: L("join.title"), path: pathFor(lang, "/join") }])} />
      <header className="page-hero">
        <h1>{L("join.title")}</h1>
        <p>{L("join.intro")}</p>
      </header>

      <section id="apply" className="section">
        <div className="section__bar"><h2>{L("join.applyTitle")}</h2><span className="label">{L("join.applyLabel")}</span></div>
        <p>{L("join.applyIntro")}</p>
        <ApplicationForm lang={lang} />
      </section>

      <section id="contact" className="section">
        <div className="section__bar"><h2>{L("join.contactTitle")}</h2><span className="label">{L("join.contactLabel")}</span></div>
        <div className="contact">
          <div><span className="l">Email</span><a href={`mailto:${SITE.email}`}>{SITE.email}</a></div>
          <div><span className="l">Facebook</span><a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">{L("join.messagePage")}</a></div>
          <div><span className="l">{L("join.location")}</span><span>{SITE.address.locality}, {SITE.address.region} {SITE.address.postalCode}</span></div>
          <div><span className="l">{L("join.templatesLabel")}</span><Link href="/resources">{L("join.templates")}</Link></div>
        </div>
      </section>

      <section id="faq" className="dune section">
        <div className="faq__grid">
          <div className="faq__head">
            <span className="label">FAQ</span>
            <h2>{L("join.faqTitle")}</h2>
          </div>
          <div lang="en"><FaqList faqs={faqs} /></div>
        </div>
      </section>

      <SiteFooter cta={false} lang={lang} altHref={lang === "hil" ? "/join" : "/hil/join"} />
    </div>
  );
}

import Image from "next/image";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import ProgressBar from "@/components/ProgressBar.jsx";
import PledgeForm from "@/components/forms/PledgeForm.jsx";
import { getDb } from "@/lib/db.js";
import { listCampaigns } from "@/lib/engagement/money.js";
import { breadcrumbLd } from "@/lib/seo.js";
import { t, pathFor } from "@/lib/i18n.js";

export default async function SupportPage({ lang = "en" }) {
  const L = (key) => t(lang, key);
  const campaigns = await listCampaigns(getDb(), { openOnly: true });
  return (
    <div lang={lang === "hil" ? "hil" : undefined}>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: pathFor(lang, "/") }, { name: L("support.title"), path: pathFor(lang, "/support") }])} />
      <header className="page-hero">
        <h1>{L("support.title")}</h1>
        <p>{L("support.intro")}</p>
      </header>
      {campaigns.map((c) => (
        <section className="section section--line-top campaign" id={c.slug} key={c.id}>
          <div className="section__bar"><h2 lang="en">{c.title}</h2><span className="label">{L("support.campaign")}</span></div>
          <div className="campaign__grid">
            <div>
              {c.description && <p lang="en">{c.description}</p>}
              <ProgressBar raisedCentavos={c.raisedCentavos} goalCentavos={c.goalCentavos} label={c.title} />
              {c.paymentInstructions && <p className="campaign__how">{c.paymentInstructions}</p>}
            </div>
            {c.qrImageUrl && (
              <figure className="campaign__qr">
                <Image src={c.qrImageUrl} alt={c.qrImageAlt ?? `QR code for ${c.title}`} width={260} height={260} style={{ objectFit: "contain", height: "auto" }} />
              </figure>
            )}
          </div>
        </section>
      ))}
      <section className="section section--line-top" id="pledge">
        <div className="section__bar"><h2>{L("support.pledgeTitle")}</h2><span className="label">{L("support.pledgeLabel")}</span></div>
        <p>{L("support.pledgeIntro")}</p>
        <PledgeForm lang={lang} campaigns={campaigns.map((c) => ({ id: c.id, title: c.title }))} defaultCampaignId={campaigns[0] ? String(campaigns[0].id) : ""} />
      </section>
      <SiteFooter lang={lang} altHref={lang === "hil" ? "/support" : "/hil/support"} />
    </div>
  );
}

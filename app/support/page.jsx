import Image from "next/image";
import SiteFooter from "@/components/SiteFooter.jsx";
import JsonLd from "@/components/JsonLd.jsx";
import ProgressBar from "@/components/ProgressBar.jsx";
import PledgeForm from "@/components/forms/PledgeForm.jsx";
import { getDb } from "@/lib/db.js";
import { listCampaigns } from "@/lib/engagement/money.js";
import { pageMetadata, breadcrumbLd } from "@/lib/seo.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Support our projects",
  description: "Donate or sponsor JCI Roxas Halaran community projects in Capiz via GCash, Maya or bank transfer. See how much each campaign has raised.",
  path: "/support",
});

export default async function Support() {
  const campaigns = await listCampaigns(getDb(), { openOnly: true });
  return (
    <>
      <JsonLd data={breadcrumbLd([{ name: "Home", path: "/" }, { name: "Support our projects", path: "/support" }])} />
      <header className="page-hero">
        <h1>Support our projects</h1>
        <p>Every peso goes to community projects in Capiz. Only payments our treasurer has confirmed count toward each goal.</p>
      </header>
      {campaigns.map((c) => (
        <section className="section section--line-top campaign" id={c.slug} key={c.id}>
          <div className="section__bar"><h2>{c.title}</h2><span className="label">Campaign</span></div>
          <div className="campaign__grid">
            <div>
              {c.description && <p>{c.description}</p>}
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
        <div className="section__bar"><h2>Tell us you paid</h2><span className="label">Pledge</span></div>
        <p>After paying with the QR code, send us your reference number so we can confirm it.</p>
        <PledgeForm campaigns={campaigns.map((c) => ({ id: c.id, title: c.title }))} defaultCampaignId={campaigns[0] ? String(campaigns[0].id) : ""} />
      </section>
      <SiteFooter />
    </>
  );
}

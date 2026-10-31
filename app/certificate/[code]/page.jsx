/* eslint-disable @next/next/no-img-element -- the certificate PNG is generated per request */
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db.js";
import { certificateView, issuedOn } from "@/lib/engagement/certificates.js";
import { SITE } from "@/lib/site.js";

export const metadata = { title: "Certificate of attendance", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Anyone holding the link can confirm the certificate is one we issued.
export default async function CertificatePage({ params }) {
  const { code } = await params;
  const view = await certificateView(getDb(), code);
  if (!view) notFound();
  const image = `/certificate/${encodeURIComponent(view.code)}/image.png`;
  return (
    <main className="cert-page">
      <div className="cert-page__head">
        <span className="badge badge--ok">✓ Verified certificate</span>
        <h1 className="syne">Certificate of attendance</h1>
        <p>Issued by {SITE.name}, a Local Organization of JCI Philippines.</p>
        <dl className="cert-page__facts">
          <dt>Issued to</dt><dd>{view.name}{view.position ? `, ${view.position}` : ""}</dd>
          <dt>Local Organization</dt><dd>{view.localOrganization}</dd>
          <dt>Event</dt><dd>{view.eventTitle}</dd>
          <dt>Date</dt><dd>{view.when}{view.venue ? ` · ${view.venue}` : ""}</dd>
          {view.issuedAt && <><dt>Issued on</dt><dd>{issuedOn(view.issuedAt)}</dd></>}
          <dt>Certified by</dt><dd>{view.signers.map(([name, title]) => `${name} (${title})`).join(", ")}</dd>
          <dt>Certificate ID</dt><dd><code>{view.code}</code></dd>
        </dl>
        <div className="actions"><a className="btn" href={image} download={`certificate-${view.code}.png`}>Download certificate</a></div>
      </div>
      <img className="cert-page__img" src={image} width={1754} height={1240} alt={`Certificate of attendance for ${view.name}, ${view.eventTitle}`} />
    </main>
  );
}

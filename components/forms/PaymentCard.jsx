import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { t } from "@/lib/i18n.js";

// The "how to pay" card beside the pledge form; it follows the campaign chosen in the form.
export default function PaymentCard({ campaign, lang = "en" }) {
  const L = (key) => t(lang, key);
  return (
    <aside className="pay-card" aria-label={L("support.howTitle")}>
      <span className="label">{L("support.howTitle")}</span>
      {campaign && <h3 lang="en">{campaign.title}</h3>}
      {campaign?.qrImageUrl ? (
        <figure className="pay-card__qr">
          <Image src={campaign.qrImageUrl} alt={campaign.qrImageAlt ?? `QR code for ${campaign.title}`} width={220} height={220} style={{ objectFit: "contain", height: "auto" }} />
        </figure>
      ) : (
        <p className="pay-card__note">{L("support.noQr")} <a href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
      )}
      <ol className="pay-card__steps">
        <li>{L("support.step1")}</li>
        <li>{L("support.step2")}</li>
        <li>{L("support.step3")}</li>
      </ol>
      {campaign?.paymentInstructions && <p className="pay-card__note" lang="en">{campaign.paymentInstructions}</p>}
    </aside>
  );
}

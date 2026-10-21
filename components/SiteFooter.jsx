import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { hilEnabled, t } from "@/lib/i18n.js";

export default function SiteFooter({ cta = true, lang = "en", altHref = null }) {
  return (
    <footer className="cta-footer">
      {cta && (
        <div className="cta-footer__inner">
          <Image src={SITE.logo} alt="" width={149} height={72} />
          <p className="cta-footer__title">{lang === "hil" ? "Mangin" : "Become a"}<br />{lang === "hil" ? "miyembro" : "member"}</p>
          <Link className="btn btn--lg" href={lang === "hil" ? "/hil/join" : "/join"}>Join JCI Roxas Halaran</Link>
        </div>
      )}
      <div className="baseline">
        <span>{SITE.name} — {SITE.address.locality}, {SITE.address.region}, {SITE.address.postalCode}</span>
        <span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ·{" "}
          <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a> ·{" "}
          <Link href="/resources">Free resources</Link> ·{" "}
          <Link href="/impact">Impact</Link> ·{" "}
          <Link href="/transparency">Transparency</Link>
          {hilEnabled() && altHref && <> · <Link href={altHref} hrefLang={lang === "hil" ? "en" : "hil"}>{t(lang, "footer.switch")}</Link></>}
        </span>
      </div>
    </footer>
  );
}

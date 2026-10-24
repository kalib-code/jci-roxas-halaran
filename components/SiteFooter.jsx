import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { FOOTER_COLUMNS } from "@/lib/routes.js";
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
      <div className="footer-cols">
        {FOOTER_COLUMNS.map((col) => (
          <nav key={col.key} aria-label={t(lang, col.key)}>
            <span className="label">{t(lang, col.key)}</span>
            <ul>{col.links.map(([href, label]) => <li key={href}><Link href={href}>{label}</Link></li>)}</ul>
          </nav>
        ))}
      </div>
      <div className="baseline">
        <span>{SITE.name} — {SITE.address.locality}, {SITE.address.region}, {SITE.address.postalCode}</span>
        <span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ·{" "}
          <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a> ·{" "}
          {/* Signed-out visitors are sent to /sign-in and back; members land in their area. */}
          <Link href="/members" prefetch={false} rel="nofollow">Member login</Link>
          {hilEnabled() && altHref && <> · <Link href={altHref} hrefLang={lang === "hil" ? "en" : "hil"}>{t(lang, "footer.switch")}</Link></>}
          {" "}· © {new Date().getFullYear()}
        </span>
      </div>
    </footer>
  );
}

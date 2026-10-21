import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/site.js";

export default function SiteFooter({ cta = true }) {
  return (
    <footer className="cta-footer">
      {cta && (
        <div className="cta-footer__inner">
          <Image src={SITE.logo} alt="" width={149} height={72} />
          <p className="cta-footer__title">Become a<br />member</p>
          <Link className="btn btn--lg" href="/join">Join JCI Roxas Halaran</Link>
        </div>
      )}
      <div className="baseline">
        <span>{SITE.name} — {SITE.address.locality}, {SITE.address.region}, {SITE.address.postalCode}</span>
        <span>
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> ·{" "}
          <a href={SITE.facebookUrl} target="_blank" rel="noopener noreferrer">Facebook</a>
        </span>
      </div>
    </footer>
  );
}

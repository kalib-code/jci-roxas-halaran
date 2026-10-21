"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { SITE } from "@/lib/site.js";
import { NAV_LINKS } from "@/lib/routes.js";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const close = () => setOpen(false);

  // E-calling cards are standalone pages, like a card handed over in person: no site menu.
  if (pathname?.startsWith("/card/")) return null;

  return (
    <nav className="nav" aria-label="Main">
      <Link className="nav__logo" href="/" aria-label={`${SITE.name} — home`} onClick={close}>
        <Image src={SITE.logo} alt={SITE.name} width={91} height={44} priority />
      </Link>
      <button
        className="nav__burger"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span></span><span></span><span></span>
      </button>
      <div className={"nav__links" + (open ? " open" : "")}>
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : undefined}
            aria-current={pathname === l.href ? "page" : undefined}
            onClick={close}
          >
            {l.label}
          </Link>
        ))}
        <Link className="btn" href="/join" onClick={close}>Become a Member</Link>
      </div>
    </nav>
  );
}

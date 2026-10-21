"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

// Renders the Cloudflare Turnstile check when a site key is configured.
// Without one (local development) it renders nothing and the server skips the check.
export default function Turnstile({ onToken }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!siteKey || !ready || !ref.current || !window.turnstile) return undefined;
    const id = window.turnstile.render(ref.current, {
      sitekey: siteKey,
      callback: (token) => onToken(token),
      "expired-callback": () => onToken(""),
    });
    return () => window.turnstile.remove(id);
  }, [siteKey, ready, onToken]);

  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="lazyOnload" onReady={() => setReady(true)} />
      <div ref={ref} className="turnstile" />
    </>
  );
}

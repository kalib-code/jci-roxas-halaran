"use client";

import { useEffect, useRef } from "react";

const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loader = null;

// One shared script load for every widget on the page (two forms on an event
// page must both render).
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve(window.turnstile);
    script.onerror = () => {
      loader = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

export const turnstileEnabled = () => Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

// Renders the Cloudflare Turnstile check when a site key is configured.
// Tokens are single-use: bump resetKey after every server check that used one.
export default function Turnstile({ onToken, resetKey = 0 }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const ref = useRef(null);
  const widget = useRef(null);

  useEffect(() => {
    if (!siteKey) return undefined;
    let cancelled = false;
    loadTurnstile()
      .then((ts) => {
        if (cancelled || !ref.current) return;
        widget.current = ts.render(ref.current, {
          sitekey: siteKey,
          callback: (token) => onToken(token),
          "expired-callback": () => onToken(""),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => onToken(""));
    return () => {
      cancelled = true;
      if (widget.current != null) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, onToken]);

  useEffect(() => {
    if (!resetKey || widget.current == null) return;
    onToken("");
    window.turnstile?.reset(widget.current);
  }, [resetKey, onToken]);

  if (!siteKey) return null;
  return <div ref={ref} className="turnstile" />;
}

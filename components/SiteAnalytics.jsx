"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";

// Admin and member pages can carry names in their URLs (directory search,
// record ids), so third-party trackers never see them.
const PRIVATE = /^\/(admin|members|sign-in)(\/|$)/;
export const isPrivatePath = (path) => PRIVATE.test(path ?? "");

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const UMAMI_ID = process.env.NEXT_PUBLIC_UMAMI_ID;

// Umami looks this up by name before every send; a falsy return drops the event.
// Its url may be a bare path or a full URL, so compare the pathname only.
export const umamiBeforeSend = (type, payload) =>
  isPrivatePath(new URL(payload?.url ?? "", window.location.origin).pathname) ? false : payload;

export default function SiteAnalytics() {
  const pathname = usePathname();
  // Set during render, so both are in place before the router reports the new URL.
  if (typeof window !== "undefined") {
    if (GA_ID) window[`ga-disable-${GA_ID}`] = isPrivatePath(pathname);
    window.umamiBeforeSend = umamiBeforeSend;
  }
  return (
    <>
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
      {UMAMI_ID && (
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id={UMAMI_ID}
          data-before-send="umamiBeforeSend"
          data-exclude-search="true"
          strategy="afterInteractive"
        />
      )}
    </>
  );
}

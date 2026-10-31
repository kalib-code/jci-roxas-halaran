import { REDIRECTS, HOST_REDIRECTS } from "./lib/redirects.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets checks build into their own folder while `next dev` uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Uploaded covers and gallery photos live on Vercel Blob.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
  // Certificates are drawn on the letterhead read from disk, so ship it with the
  // functions that render them.
  outputFileTracingIncludes: {
    "/certificate/[code]/image.png": ["./public/assets/img/jcip/letterhead-2026-landscape.png"],
    "/api/cron/certificates": ["./public/assets/img/jcip/letterhead-2026-landscape.png"],
    "/admin/events/[id]": ["./public/assets/img/jcip/letterhead-2026-landscape.png"],
  },
  async redirects() {
    return [...HOST_REDIRECTS, ...REDIRECTS];
  },
};

export default nextConfig;

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
  async redirects() {
    return [...HOST_REDIRECTS, ...REDIRECTS];
  },
};

export default nextConfig;

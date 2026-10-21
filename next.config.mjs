import { REDIRECTS } from "./lib/redirects.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets checks build into their own folder while `next dev` uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async redirects() {
    return REDIRECTS;
  },
};

export default nextConfig;

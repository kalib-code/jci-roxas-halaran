import { REDIRECTS } from "./lib/redirects.js";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return REDIRECTS;
  },
};

export default nextConfig;

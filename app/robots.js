import { absoluteUrl } from "@/lib/seo.js";

export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/members", "/sign-in"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}

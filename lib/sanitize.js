import sanitizeHtml from "sanitize-html";
import { SITE } from "./site.js";

const BLOB_HOST = /\.public\.blob\.vercel-storage\.com$/;

function isAllowedImage(src = "", siteUrl) {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && (BLOB_HOST.test(url.hostname) || src.startsWith(`${siteUrl}/`));
  } catch {
    return false;
  }
}

// Server-side allow-list for article and project bodies (spec §4).
// headingIds keeps id on h2 so a page can link to its sections; stored bodies never get it.
export function cleanHtml(html, { siteUrl = SITE.url, headingIds = false } = {}) {
  return sanitizeHtml(html ?? "", {
    allowedTags: ["h2", "h3", "p", "br", "strong", "em", "ul", "ol", "li", "a", "blockquote", "img"],
    allowedAttributes: { a: ["href", "rel", "target"], img: ["src", "alt"], ...(headingIds && { h2: ["id"] }) },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    selfClosing: ["img", "br"],
    exclusiveFilter: (frame) => frame.tag === "img" && !isAllowedImage(frame.attribs.src, siteUrl),
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href;
        if (!href) return { tagName, attribs: {} };
        const external = /^https?:\/\//.test(href) && !href.startsWith(`${siteUrl}/`) && href !== siteUrl;
        return {
          tagName,
          attribs: external ? { href, rel: "noopener noreferrer", target: "_blank" } : { href },
        };
      },
    },
  });
}

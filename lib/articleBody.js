import { cleanHtml } from "./sanitize.js";
import { slugify } from "./format.js";

const H2 = /<h2>([\s\S]*?)<\/h2>/g;

function textOf(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
}

// Cleans a stored body, then gives each h2 an id so the page can link to it.
// The rewritten string is cleaned again (keeping only h2 ids), so the regex
// edit can never leave unsafe markup behind.
export function outlineBody(html) {
  const used = new Set();
  const headings = [];
  const out = cleanHtml(html ?? "").replace(H2, (_, inner) => {
    const text = textOf(inner);
    const base = slugify(text) || "section";
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    headings.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: cleanHtml(out, { headingIds: true }), headings };
}

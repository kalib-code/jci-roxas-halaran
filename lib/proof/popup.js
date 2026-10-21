import { formatDate } from "../format.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Leaflet popups take HTML strings; everything from the database is escaped.
export function popupHtml(p) {
  const meta = [formatDate(p.startDate), p.barangay].filter(Boolean).map(esc).join(" · ");
  return `<strong>${esc(p.title)}</strong>${meta ? `<br>${meta}` : ""}<br><a href="/projects/${encodeURIComponent(p.slug)}">View project</a>`;
}

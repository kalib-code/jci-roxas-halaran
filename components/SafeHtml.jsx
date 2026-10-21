import { cleanHtml } from "@/lib/sanitize.js";

// Renders stored rich text. Bodies are cleaned on save too; cleaning again at
// render keeps pages safe even if the database is edited another way.
export function SafeHtml({ html, className }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: cleanHtml(html ?? "") }} />;
}

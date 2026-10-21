const cut = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
export const previewTitle = (t) => cut(t, 60);
export const previewDescription = (d) => cut(d, 158);

export default function GooglePreview({ title, slug, description, basePath }) {
  return (
    <div className="gpreview" aria-label="Google search preview">
      <span className="gpreview__url">jciroxashalaran.com › {basePath.replace(/^\//, "")} › {slug || "…"}</span>
      <span className="gpreview__title">{previewTitle(`${title || "Untitled"} | JCI Roxas Halaran`)}</span>
      <span className="gpreview__desc">{previewDescription(description || "Add a meta description.")}</span>
    </div>
  );
}

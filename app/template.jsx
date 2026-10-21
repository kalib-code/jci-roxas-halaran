// Re-mounts on every navigation (unlike layout.jsx), so each page plays its entrance.
export default function Template({ children }) {
  return <div className="page-in">{children}</div>;
}

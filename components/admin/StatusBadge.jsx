import { badgeTone } from "@/lib/admin/status.js";

export default function StatusBadge({ status }) {
  return <span className={`badge badge--${badgeTone(status)}`}>{String(status).replace(/_/g, " ")}</span>;
}

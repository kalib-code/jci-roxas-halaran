import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listAudit } from "@/lib/audit.js";
import { csvCell as cell } from "@/lib/safe.js";

export async function GET() {
  await requireArea("content");
  const { rows } = await listAudit(getDb(), { limit: 100000 });
  const csv = [
    ["Time (UTC)", "Who", "Action", "Summary", "Record", "Details"].map(cell).join(","),
    ...rows.map((r) =>
      [r.createdAt, r.actorName ?? r.actorId, r.action, r.summary, r.targetTable ? `${r.targetTable}#${r.targetId ?? ""}` : "", r.details ? JSON.stringify(r.details) : ""].map(cell).join(","),
    ),
  ].join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="admin-activity.csv"' },
  });
}

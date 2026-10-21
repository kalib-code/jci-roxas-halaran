import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getEvent, listRsvps } from "@/lib/engagement/events.js";

const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(_request, { params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const event = await getEvent(db, id);
  if (!event) return new Response("Not found", { status: 404 });
  const rows = await listRsvps(db, event.id);
  const csv = [
    ["Name", "Email", "Phone", "Status", "Attended", "RSVP time"].map(cell).join(","),
    ...rows.map((r) => [r.name, r.email, r.phone, r.status, r.attended ? "yes" : "no", r.createdAt].map(cell).join(",")),
  ].join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${event.slug}-rsvps.csv"` },
  });
}

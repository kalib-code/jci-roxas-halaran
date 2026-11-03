import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { listVolunteers } from "@/lib/engagement/events.js";
import { csvCell as cell } from "@/lib/safe.js";

export async function GET() {
  await requireArea("content");
  const rows = await listVolunteers(getDb());
  const csv = [
    ["Name", "Email", "Phone", "Skills", "For", "Role", "Status", "Signed up"].map(cell).join(","),
    ...rows.map((v) => [v.name, v.email, v.phone, v.skills, v.driveTitle ?? v.projectTitle ?? v.eventTitle ?? "Any project", v.roleLabel, v.status, v.createdAt].map(cell).join(",")),
  ].join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="volunteers.csv"' },
  });
}

import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getDrive, listDriveSignups } from "@/lib/engagement/volunteers.js";
import { csvCell as cell } from "@/lib/safe.js";

export async function GET(_request, { params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const drive = await getDrive(db, id);
  if (!drive) return new Response("Not found", { status: 404 });
  const rows = await listDriveSignups(db, drive.id);
  const csv = [
    ["Name", "Email", "Phone", "Role", "Status", "Note", "Signed up"].map(cell).join(","),
    ...rows.map((s) => [s.name, s.email, s.phone, s.roleLabel, s.status, s.skills, s.createdAt].map(cell).join(",")),
  ].join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="volunteers-${drive.slug}.csv"` },
  });
}

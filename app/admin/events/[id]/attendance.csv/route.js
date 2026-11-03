import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getEvent } from "@/lib/engagement/events.js";
import { listAttendance, attendedFully } from "@/lib/engagement/attendance.js";
import { csvCell as cell } from "@/lib/safe.js";

const AFFILIATION = { home: "JCI Roxas Halaran member", other_lo: "Other JCI chapter", guest: "Non-JCI guest" };
const SOURCE = { qr: "QR check-in", admin: "Added by organizer", rsvp: "RSVP marked attended", online: "Online check-in" };
const STAMP = new Intl.DateTimeFormat("en-CA", { dateStyle: "short", timeStyle: "medium", hourCycle: "h23", timeZone: "Asia/Manila" });

export async function GET(_request, { params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const event = await getEvent(db, id);
  if (!event) return new Response("Not found", { status: 404 });
  const rows = await listAttendance(db, event.id);
  const csv = [
    ["Name", "Position", "Local Organization", "Affiliation", "Email", "Time in (PH)", "Time out (PH)", "Recorded by", "Counts as attended"].map(cell).join(","),
    ...rows.map((r) => [
      r.name, r.position, r.localOrganization, AFFILIATION[r.affiliation], r.email,
      STAMP.format(new Date(r.checkedInAt)), r.checkedOutAt ? STAMP.format(new Date(r.checkedOutAt)) : "",
      SOURCE[r.source], attendedFully(r) ? "Yes" : "No — no end code",
    ].map(cell).join(",")),
  ].join("\r\n");
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${event.slug}-attendance.csv"` },
  });
}

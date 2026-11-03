import Link from "next/link";
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getEvent } from "@/lib/engagement/events.js";
import { listAttendance, sheetCertifiers, attendedFully } from "@/lib/engagement/attendance.js";
import AttendanceSheet from "@/components/admin/AttendanceSheet.jsx";
import PrintButton from "@/components/admin/PrintButton.jsx";

export const metadata = { title: "Attendance sheet — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AttendanceSheetPage({ params, searchParams }) {
  await requireArea("content");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = getDb();
  const event = await getEvent(db, id);
  if (!event) notFound();
  const layout = sp?.layout === "landscape" ? "landscape" : "portrait";
  const blank = sp?.blank === "1";
  const [all, certifiers] = await Promise.all([listAttendance(db, event.id), sheetCertifiers(db, event)]);
  // Online attendees who left before the end code aren't certified as attending.
  const rows = all.filter(attendedFully);
  const left = all.length - rows.length;
  const href = (patch) => `?${new URLSearchParams({ layout, ...(blank ? { blank: "1" } : {}), ...patch })}`.replace(/&?blank=0/, "");
  return (
    <div className="admin sheet-screen">
      <div className="sheet-toolbar">
        <Link href={`/admin/events/${event.id}#attendance`}>← Back to {event.title}</Link>
        <nav aria-label="Sheet options" className="sheet-toolbar__opts">
          <Link aria-current={layout === "portrait" ? "true" : undefined} href={href({ layout: "portrait" })}>Portrait</Link>
          <Link aria-current={layout === "landscape" ? "true" : undefined} href={href({ layout: "landscape" })}>Landscape</Link>
          <span aria-hidden="true">·</span>
          <Link aria-current={!blank ? "true" : undefined} href={href({ blank: "0" })}>Digital ({rows.length})</Link>
          <Link aria-current={blank ? "true" : undefined} href={href({ blank: "1" })}>Blank paper sheet</Link>
        </nav>
        <PrintButton />
      </div>
      {!blank && left > 0 && <p className="count">Leaving out {left} online {left === 1 ? "person" : "people"} who didn&apos;t enter the end code. Count them as stayed on the event page if they did attend.</p>}
      {!blank && rows.length === 0 && <p className="form-errors">No one has checked in yet. Open check-in on the event page, or print a blank paper sheet.</p>}
      <div className="sheet-scroll">
        <AttendanceSheet event={event} rows={rows} certifiers={certifiers} layout={layout} blank={blank} />
      </div>
    </div>
  );
}

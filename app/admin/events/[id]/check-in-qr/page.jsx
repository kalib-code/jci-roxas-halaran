import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getEvent } from "@/lib/engagement/events.js";
import { checkinIsOpen } from "@/lib/engagement/attendance.js";
import { qrSvg, checkinUrl, originFrom, PRINT_COLORS } from "@/lib/members/qr.js";
import { LetterheadPage } from "@/components/admin/AttendanceSheet.jsx";
import PrintButton from "@/components/admin/PrintButton.jsx";

export const metadata = { title: "Check-in QR — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

// A poster for the registration table: print it, or put it on the projector.
export default async function CheckinPoster({ params }) {
  await requireArea("content");
  const { id } = await params;
  const event = await getEvent(getDb(), id);
  if (!event) notFound();
  const back = <Link href={`/admin/events/${event.id}#attendance`}>← Back to {event.title}</Link>;
  if (!checkinIsOpen(event)) {
    return <div className="admin">{back}<h1>Check-in is closed</h1><p>Open check-in on the event page to get its QR code.</p></div>;
  }
  const url = checkinUrl(originFrom(await headers()), event.checkinCode);
  const svg = await qrSvg(url, { colors: PRINT_COLORS });
  return (
    <div className="admin sheet-screen">
      <div className="sheet-toolbar">{back}<PrintButton>Print poster</PrintButton></div>
      <div className="sheet-scroll">
        <div className="sheet-print">
          <style>{"@page { size: A4 portrait; margin: 0; }"}</style>
          <LetterheadPage event={event} label="Check-in QR poster">
            <div className="sheet-poster">
              <h1 className="sheet-title">SCAN TO CHECK IN</h1>
              {!event.weChair && <p className="sheet-poster__for">For JCI Roxas Halaran members</p>}
              {svg && <div className="sheet-poster__qr" role="img" aria-label="Check-in QR code" dangerouslySetInnerHTML={{ __html: svg }} />}
              <p className="sheet-poster__url">{url.replace(/^https?:\/\//, "")}</p>
              <ol className="sheet-poster__steps">
                <li>Open your phone camera and point it at the code.</li>
                <li>Enter your name, position and Local Organization.</li>
                <li>Tap <strong>Check in</strong>. Your time is recorded for the attendance sheet.</li>
              </ol>
            </div>
          </LetterheadPage>
        </div>
      </div>
    </div>
  );
}

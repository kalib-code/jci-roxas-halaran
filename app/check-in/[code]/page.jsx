import { notFound } from "next/navigation";
import { getDb } from "@/lib/db.js";
import { getCheckinEvent, checkinIsOpen, checksNearby, isOnlineLink } from "@/lib/engagement/attendance.js";
import { eventWhen } from "@/lib/engagement/attendance-sheet.js";
import CheckinForm from "@/components/forms/CheckinForm.jsx";

export const metadata = { title: "Event check-in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// Reached only by scanning the event's QR code: the code in the address is the key.
export default async function CheckinPage({ params }) {
  const { code } = await params;
  const event = await getCheckinEvent(getDb(), code);
  if (!event) notFound();
  const online = isOnlineLink(event, code);
  const info = { title: event.title, when: eventWhen(event), venue: online ? `Online${event.venue && event.format === "online" ? ` · ${event.venue}` : ""}` : event.venue };
  return (
    <main className="checkin-page">
      {checkinIsOpen(event) ? (
        <CheckinForm code={code} event={info} membersOnly={!event.weChair} online={online} nearby={!online && checksNearby(event) ? { lat: event.lat, lng: event.lng } : null} />
      ) : (
        <div className="checkin">
          <div className="checkin__event">
            <span className="label label--sm">Event check-in</span>
            <h1 className="checkin__title">{info.title}</h1>
            <p>{info.when}</p>
          </div>
          <p className="form-errors">{online ? "Check-in for this event is closed. If you attended, message the organizers to be added." : <>Check-in for this event is closed. If you&apos;re at the event, ask an organizer at the registration table to add you.</>}</p>
        </div>
      )}
    </main>
  );
}

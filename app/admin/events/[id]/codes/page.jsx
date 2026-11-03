import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getEvent } from "@/lib/engagement/events.js";
import { checkinPanel } from "@/lib/engagement/checkin-panel.js";
import { originFrom, qrSvg } from "@/lib/members/qr.js";
import { eventWhen } from "@/lib/engagement/attendance-sheet.js";
import RevealEndCode from "@/components/admin/RevealEndCode.jsx";

export const metadata = { title: "Check-in codes — Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const spaced = (code) => `${code.slice(0, 3)} ${code.slice(3)}`;

// A screen to share in the meeting: the online check-in link and the code to
// type, without the attendance list beside it.
export default async function CheckinCodes({ params }) {
  await requireArea("content");
  const { id } = await params;
  const db = getDb();
  const found = await getEvent(db, id);
  if (!found) notFound();
  const { event, checkin } = await checkinPanel(db, found, originFrom(await headers()));
  const back = <Link href={`/admin/events/${event.id}#attendance`}>← Back to {event.title}</Link>;
  const online = checkin.online;
  if (!online) {
    return (
      <div className="admin">
        {back}
        <h1>No online check-in</h1>
        <p>{checkin.open ? "Set the event to Online or Hybrid to get an online link and codes." : "Open check-in on the event page first."}</p>
      </div>
    );
  }
  const svg = await qrSvg(online.url);
  const ending = Boolean(online.endCode && online.endCodeOpen);
  return (
    <div className="codes-screen">
      <div className="codes-screen__bar">{back}<RevealEndCode eventId={event.id} shown={Boolean(online.endCode)} open={online.endCodeOpen} /></div>
      <main className="codes-screen__stage">
        <p className="codes-screen__event">{event.title} · {eventWhen(event)}</p>
        <div className="codes-screen__grid">
          <section className="codes-screen__code">
            <h1 className="codes-screen__label">{ending ? "End code" : "Start code"}</h1>
            <p className="codes-screen__digits">{spaced(ending ? online.endCode : online.startCode)}</p>
            <p className="codes-screen__hint">
              {ending ? `Enter it on the check-in page to get your certificate. Until ${online.endCodeUntil}.` : "Open the check-in link, fill in your details and type this code."}
            </p>
            {ending && <p className="codes-screen__late">Joined late? Check in first with start code {spaced(online.startCode)}.</p>}
          </section>
          <section className="codes-screen__link">
            {svg && <div className="codes-screen__qr" role="img" aria-label="Online check-in QR code" dangerouslySetInnerHTML={{ __html: svg }} />}
            <p className="codes-screen__url">{online.url.replace(/^https?:\/\//, "")}</p>
            <p className="codes-screen__hint">Scan with your phone, or use the link in the chat.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

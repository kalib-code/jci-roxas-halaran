import { checkinIsOpen, endCodeOpen, END_CODE_WINDOW_MS, hasOnline, hasRoom, setCheckin } from "./attendance.js";
import { qrSvg, checkinUrl } from "../members/qr.js";

const CLOCK = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const clock = (ms) => CLOCK.format(new Date(ms)).replace(/ /g, " ");

// What the organizer's Attendance panel needs about check-in. The end code is
// left out until it's shown, so a screen shared early can't leak it.
export async function checkinPanel(db, event, origin, { now = new Date() } = {}) {
  let ev = event;
  const open = checkinIsOpen(ev, now);
  // Check-in opened before the event went online or hybrid: make its link and codes now.
  if (open && hasOnline(ev) && !(ev.onlineCode && ev.startCode && ev.endCode)) ev = (await setCheckin(db, ev.id, { open: true })).event;
  const roomUrl = open && hasRoom(ev) ? checkinUrl(origin, ev.checkinCode) : null;
  const shown = Boolean(ev.endCodeShownAt);
  return {
    event: ev,
    checkin: {
      open,
      url: roomUrl,
      qrSvg: roomUrl ? await qrSvg(roomUrl) : null,
      online: open && hasOnline(ev)
        ? {
            url: checkinUrl(origin, ev.onlineCode),
            startCode: ev.startCode,
            endCode: shown ? ev.endCode : null,
            endCodeOpen: endCodeOpen(ev, now),
            endCodeUntil: shown ? clock(new Date(ev.endCodeShownAt).getTime() + END_CODE_WINDOW_MS) : null,
          }
        : null,
    },
  };
}

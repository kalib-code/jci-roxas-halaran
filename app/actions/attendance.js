"use server";

import { getDb } from "@/lib/db.js";
import { verifyTurnstile } from "@/lib/turnstile.js";
import { checkIn } from "@/lib/engagement/attendance.js";

const BOT = { ok: false, errors: ["Please complete the check and try again"] };
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", month: "short", day: "numeric", timeZone: "Asia/Manila" });

export async function checkInAction(input) {
  if (!(await verifyTurnstile(input?.turnstileToken))) return BOT;
  const r = await checkIn(getDb(), input);
  if (!r.ok) return r;
  // A repeat returns nothing from the stored row (not its name, not its time), so
  // typing someone's name or email can't tell you whether or when they arrived.
  const name = String(input?.name ?? "").trim();
  if (r.already) return { ok: true, already: true, name, at: null };
  return { ok: true, already: false, name, at: TIME.format(new Date(r.attendee.checkedInAt)).replace(/\u202f/g, " ") };
}

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
  const at = TIME.format(new Date(r.attendee?.checkedInAt ?? Date.now())).replace(/\u202f/g, " ");
  // Echo back only what they typed: a repeat match by email must not reveal whose row it is.
  return { ok: true, already: Boolean(r.already), name: String(input?.name ?? "").trim(), at };
}

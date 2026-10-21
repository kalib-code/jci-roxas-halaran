import { eventsLog } from "../db/schema.js";

// Every countable action, tagged with the Temiong criterion it supports.
export const LOG_CRITERIA = {
  application_submitted: "interactivity",
  rsvp_created: "interactivity",
  volunteer_signed_up: "interactivity",
  pledge_submitted: "interactivity",
  member_approved: "member_value",
  attendance_marked: "member_value",
  payment_confirmed: "planning",
  expense_recorded: "planning",
  article_published: "planning",
};

export async function logEvent(db, { type, actor = "public", refTable = null, refId = null, meta = null, now = new Date().toISOString() }) {
  const criterion = LOG_CRITERIA[type];
  if (!criterion) throw new Error(`Unknown log type ${type}`);
  await db.insert(eventsLog).values({
    type,
    criterion,
    actor,
    refTable,
    refId,
    meta: meta ? JSON.stringify(meta) : null,
    createdAt: now,
  });
}

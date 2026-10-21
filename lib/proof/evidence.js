import { asc, count, desc } from "drizzle-orm";
import { z } from "zod";
import { eventsLog, analyticsSnapshots } from "../../db/schema.js";
import { phNow, phToday } from "../format.js";
import { csvCell } from "../safe.js";

export const CRITERIA = ["planning", "layout", "interactivity", "member_value"];
export const CRITERION_LABELS = {
  planning: "Planning & execution",
  layout: "Layout & presentation",
  interactivity: "Interactivity & services",
  member_value: "Value to members",
};

export function lastMonths(now, n) {
  const [y, m] = phNow(now).slice(0, 7).split("-").map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export async function monthlyEvidence(db, { now = new Date(), months = 12 } = {}) {
  const list = lastMonths(now, months);
  const rows = await db.select({ criterion: eventsLog.criterion, createdAt: eventsLog.createdAt }).from(eventsLog);
  const matrix = new Map(list.map((month) => [month, { month, planning: 0, layout: 0, interactivity: 0, member_value: 0, total: 0 }]));
  for (const r of rows) {
    const cell = matrix.get(phToday(r.createdAt).slice(0, 7));
    if (cell && r.criterion in cell) {
      cell[r.criterion] += 1;
      cell.total += 1;
    }
  }
  return [...matrix.values()];
}

export function typeTotals(db) {
  return db.select({ type: eventsLog.type, n: count() }).from(eventsLog).groupBy(eventsLog.type).orderBy(desc(count()));
}

const optionalCount = z
  .preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int("Use whole numbers").min(0, "Use 0 or more").nullable())
  .default(null);

export const snapshotInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Use a month like 2026-11"),
  organicClicks: optionalCount,
  impressions: optionalCount,
  visitors: optionalCount,
  note: z.string().trim().max(300).default(""),
});

export async function upsertSnapshot(db, raw, { userId, now = new Date().toISOString() }) {
  const parsed = snapshotInput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const d = parsed.data;
  const values = { organicClicks: d.organicClicks, impressions: d.impressions, visitors: d.visitors, note: d.note || null, updatedBy: userId, updatedAt: now };
  const [snapshot] = await db
    .insert(analyticsSnapshots)
    .values({ month: d.month, ...values })
    .onConflictDoUpdate({ target: analyticsSnapshots.month, set: values })
    .returning();
  return { ok: true, snapshot };
}

export function listSnapshots(db) {
  return db.select().from(analyticsSnapshots).orderBy(desc(analyticsSnapshots.month));
}

export function evidenceCsv(matrix, snapshots) {
  const byMonth = new Map(snapshots.map((s) => [s.month, s]));
  const header = ["Month", ...CRITERIA.map((c) => CRITERION_LABELS[c]), "Total", "Organic clicks", "Impressions", "Visitors", "Note"];
  const rows = matrix.map((r) => {
    const s = byMonth.get(r.month) ?? {};
    return [r.month, ...CRITERIA.map((c) => r[c]), r.total, s.organicClicks, s.impressions, s.visitors, s.note];
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function logCsv(db) {
  const rows = await db.select().from(eventsLog).orderBy(asc(eventsLog.createdAt), asc(eventsLog.id));
  const header = ["Date", "Type", "Criterion", "Actor", "Ref table", "Ref id"];
  return [header, ...rows.map((r) => [r.createdAt, r.type, r.criterion, r.actor, r.refTable, r.refId])]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { projectMetrics } from "../../db/schema.js";
import { METRICS } from "./metric-labels.js";

export { METRICS };

const metricRow = z.object({
  metric: z.enum(Object.keys(METRICS), { errorMap: () => ({ message: "Choose a metric" }) }),
  value: z.coerce.number().int("Use whole numbers").min(0, "Use 0 or more").max(10_000_000),
});

export async function setProjectMetrics(db, projectId, rows) {
  const parsed = z.array(metricRow).max(20).safeParse(rows ?? []);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const merged = new Map(parsed.data.map((r) => [r.metric, r.value]));
  await db.delete(projectMetrics).where(eq(projectMetrics.projectId, Number(projectId)));
  if (merged.size) {
    await db.insert(projectMetrics).values([...merged].map(([metric, value]) => ({ projectId: Number(projectId), metric, value })));
  }
  return { ok: true, metrics: Object.fromEntries(merged) };
}

export function listProjectMetrics(db, projectId) {
  return db.select().from(projectMetrics).where(eq(projectMetrics.projectId, Number(projectId))).orderBy(asc(projectMetrics.metric));
}

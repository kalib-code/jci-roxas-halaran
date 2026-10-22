import { asc, count, eq, isNotNull, and, sql } from "drizzle-orm";
import { projects, members, volunteerSignups, projectMetrics, events } from "../../db/schema.js";
import { phNow } from "../format.js";
import { METRICS } from "./metric-labels.js";
import { SITE } from "../site.js";

export async function impactTotals(db, { now = new Date() } = {}) {
  const [[done], [active], [vols], metricRows, eventRows] = await Promise.all([
    db.select({ n: count() }).from(projects).where(eq(projects.status, "done")),
    db.select({ n: count() }).from(members).where(eq(members.status, "active")),
    db.select({ n: count() }).from(volunteerSignups),
    db.select({ metric: projectMetrics.metric, total: sql`sum(${projectMetrics.value})` }).from(projectMetrics).groupBy(projectMetrics.metric),
    db.select({ startAt: events.startAt, endAt: events.endAt }).from(events),
  ]);
  const today = phNow(now);
  return {
    projectsDone: done.n,
    activeMembers: active.n,
    volunteers: vols.n,
    eventsHeld: eventRows.filter((e) => (e.endAt || e.startAt) < today).length,
    metrics: Object.fromEntries(metricRows.map((r) => [r.metric, Number(r.total)])),
  };
}

export function mapProjects(db) {
  return db
    .select({ id: projects.id, slug: projects.slug, title: projects.title, startDate: projects.startDate, barangay: projects.barangay, lat: projects.lat, lng: projects.lng })
    .from(projects)
    .where(and(isNotNull(projects.lat), isNotNull(projects.lng)))
    .orderBy(asc(projects.title));
}

const UNKNOWN = "Location to be added";

export async function projectsByBarangay(db) {
  const rows = await db.select({ id: projects.id, slug: projects.slug, title: projects.title, barangay: projects.barangay }).from(projects).orderBy(asc(projects.title));
  const groups = new Map();
  for (const p of rows) {
    const key = p.barangay?.trim() || UNKNOWN;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === UNKNOWN) - (b === UNKNOWN) || a.localeCompare(b))
    .map(([barangay, list]) => ({ barangay, projects: list }));
}

const statedNumber = (value) => Number.parseInt(String(value).replace(/[^\d]/g, ""), 10) || 0;

// Live figures replace the chapter's stated figures only when they are larger.
export function homeStats(totals, fallback) {
  const live = [null, totals.projectsDone, totals.metrics?.barangays ?? 0, totals.activeMembers];
  return fallback.map((stat, i) =>
    live[i] !== null && live[i] > statedNumber(stat.value) ? { value: String(live[i]), label: stat.label } : stat,
  );
}

// Public impact figures; zeros are left out so the page never advertises "0 volunteers".
export function impactStats(totals, { memberFloor = SITE.memberCount } = {}) {
  return [
    ["Projects completed", totals.projectsDone],
    ["Active members", Math.max(totals.activeMembers, memberFloor)],
    ["Volunteers signed up", totals.volunteers],
    ["Events held", totals.eventsHeld],
    ...Object.entries(METRICS).map(([key, label]) => [label, totals.metrics?.[key] ?? 0]),
  ].filter(([, value]) => value > 0);
}

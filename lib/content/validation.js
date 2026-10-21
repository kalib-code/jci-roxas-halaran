import { z } from "zod";

export const CATEGORIES = ["capiz", "holidays", "leadership", "business", "community"];
export const CATEGORY_LABELS = {
  capiz: "Capiz",
  holidays: "Holidays",
  leadership: "Leadership",
  business: "Business",
  community: "Community",
};

const optionalId = z.preprocess(
  (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
  z.number().int().positive().nullable(),
);
const text = (max) => z.string().trim().max(max).default("");

export const articleInput = z.object({
  title: text(160),
  slug: text(120),
  metaDescription: z.string().trim().max(160, "Meta description must be 160 characters or fewer").default(""),
  targetKeyword: text(80),
  category: z.enum(CATEGORIES).default("community"),
  bodyJson: z.string().default(""),
  bodyHtml: z.string().default(""),
  coverUrl: text(500),
  coverAlt: text(200),
  authorId: optionalId.default(null),
  projectId: optionalId.default(null),
});

export const projectInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  slug: text(120),
  summary: text(300),
  startDate: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a date like 2026-11-30").default(""),
  endDate: z.string().trim().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a date like 2026-11-30").default(""),
  barangay: text(120),
  pillar: z.enum(["leadership", "community", "global"]).default("community"),
  status: z.enum(["planned", "ongoing", "done"]).default("done"),
  coverUrl: text(500),
  coverAlt: text(200),
  bodyJson: z.string().default(""),
  bodyHtml: z.string().default(""),
});

export const resourceInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  description: text(300),
  fileUrl: z
    .string()
    .trim()
    .regex(/^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i, "Upload a file first"),
  kind: z.enum(["template", "training", "bylaws", "other"]).default("template"),
  visibility: z.enum(["public", "members"]).default("public"),
});

export function hasText(html) {
  return (html ?? "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
}

export function imageAltProblems(html) {
  const imgs = (html ?? "").match(/<img\b[^>]*>/gi) ?? [];
  return imgs.filter((tag) => !/\balt="[^"]*\S[^"]*"/i.test(tag)).length;
}

export function publishProblems(a) {
  const problems = [];
  if (!a.title?.trim()) problems.push("Add a title");
  if (!a.metaDescription?.trim()) problems.push("Add a meta description");
  if (!a.targetKeyword?.trim()) problems.push("Add a target keyword");
  if (!hasText(a.bodyHtml)) problems.push("Write the article body");
  if (a.coverUrl && !a.coverAlt?.trim()) problems.push("Add alt text for the cover image");
  const missingAlt = imageAltProblems(a.bodyHtml);
  if (missingAlt) problems.push(`Add alt text to ${missingAlt} image${missingAlt > 1 ? "s" : ""} in the body`);
  return problems;
}

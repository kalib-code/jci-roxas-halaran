import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const members = sqliteTable("members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clerkUserId: text("clerk_user_id").unique(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  photoUrl: text("photo_url"),
  profession: text("profession"),
  business: text("business"),
  skills: text("skills"),
  bio: text("bio"),
  quote: text("quote"),
  joinedAt: text("joined_at"),
  status: text("status", { enum: ["active", "inactive", "senator", "alumni"] })
    .notNull()
    .default("active"),
  inDirectory: integer("in_directory", { mode: "boolean" }).notNull().default(false),
  feePaidYear: integer("fee_paid_year"),
});

export const officerTerms = sqliteTable(
  "officer_terms",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    year: integer("year").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [uniqueIndex("officer_terms_member_year_role").on(t.memberId, t.year, t.role)],
);

export const projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  body: text("body"),
  coverUrl: text("cover_url"),
  coverAlt: text("cover_alt"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  barangay: text("barangay"),
  lat: real("lat"),
  lng: real("lng"),
  pillar: text("pillar", { enum: ["leadership", "community", "global"] })
    .notNull()
    .default("community"),
  status: text("status", { enum: ["planned", "ongoing", "done"] }).notNull().default("done"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  bodyJson: text("body_json"),
  updatedAt: text("updated_at"),
});

export const projectPhotos = sqliteTable("project_photos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  alt: text("alt").notNull(),
  kind: text("kind", { enum: ["gallery", "before", "after"] }).notNull().default("gallery"),
  sort: integer("sort").notNull().default(0),
});

export const faqs = sqliteTable("faqs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  question: text("question").notNull().unique(),
  answer: text("answer").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const awards = sqliteTable(
  "awards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    awardedBy: text("awarded_by").notNull(),
    year: integer("year").notNull(),
  },
  (t) => [uniqueIndex("awards_title_year").on(t.title, t.year)],
);

export const sponsors = sqliteTable("sponsors", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  logoUrl: text("logo_url"),
  url: text("url"),
  tier: text("tier"),
  year: integer("year"),
});

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  metaDescription: text("meta_description"),
  targetKeyword: text("target_keyword"),
  category: text("category", { enum: ["capiz", "holidays", "leadership", "business", "community"] })
    .notNull()
    .default("community"),
  bodyJson: text("body_json"),
  bodyHtml: text("body_html"),
  coverUrl: text("cover_url"),
  coverAlt: text("cover_alt"),
  authorId: integer("author_id").references(() => members.id, { onDelete: "set null" }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  publishedAt: text("published_at"),
  updatedAt: text("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

export const seoPlan = sqliteTable(
  "seo_plan",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    month: text("month").notNull(),
    keyword: text("keyword").notNull(),
    volume: integer("volume"),
    kd: integer("kd"),
    workingTitle: text("working_title"),
    status: text("status", { enum: ["idea", "drafting", "published"] }).notNull().default("idea"),
    articleId: integer("article_id").references(() => articles.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("seo_plan_month_keyword").on(t.month, t.keyword)],
);

export const resources = sqliteTable("resources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  kind: text("kind", { enum: ["template", "training", "bylaws", "other"] }).notNull().default("template"),
  visibility: text("visibility", { enum: ["public", "members"] }).notNull().default("public"),
  createdAt: text("created_at").notNull(),
});

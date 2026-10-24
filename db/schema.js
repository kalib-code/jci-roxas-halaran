import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
  phone: text("phone"),
  websiteUrl: text("website_url"),
  facebookUrl: text("facebook_url"),
  linkedinUrl: text("linkedin_url"),
  instagramUrl: text("instagram_url"),
  cardPublished: integer("card_published", { mode: "boolean" }).notNull().default(false),
  cardShowPhone: integer("card_show_phone", { mode: "boolean" }).notNull().default(false),
  cardShowEmail: integer("card_show_email", { mode: "boolean" }).notNull().default(true),
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

// Videos and audio shown on a project page. Only the link is stored; the embed
// is rebuilt from it by lib/media.js.
export const projectMedia = sqliteTable(
  "project_media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [uniqueIndex("project_media_project_url").on(t.projectId, t.url)],
);

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

export const applications = sqliteTable(
  "applications",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    birthdate: text("birthdate").notNull(),
    barangay: text("barangay"),
    whyJoin: text("why_join"),
    referredBy: text("referred_by"),
    consent: integer("consent", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["pending", "approved", "declined"] }).notNull().default("pending"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: text("reviewed_at"),
    note: text("note"),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("applications_pending_email").on(t.email).where(sql`status = 'pending'`)],
);

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  descriptionJson: text("description_json"),
  startAt: text("start_at").notNull(),
  endAt: text("end_at"),
  venue: text("venue"),
  capacity: integer("capacity"),
  rsvpOpen: integer("rsvp_open", { mode: "boolean" }).notNull().default(true),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  coverUrl: text("cover_url"),
  coverAlt: text("cover_alt"),
  updatedAt: text("updated_at").notNull(),
});

export const rsvps = sqliteTable(
  "rsvps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    consent: integer("consent", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["going", "waitlist", "cancelled"] }).notNull().default("going"),
    attended: integer("attended", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("rsvps_event_email").on(t.eventId, t.email)],
);

export const volunteerSignups = sqliteTable("volunteer_signups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  skills: text("skills"),
  consent: integer("consent", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  goalCentavos: integer("goal_centavos").notNull(),
  qrImageUrl: text("qr_image_url"),
  qrImageAlt: text("qr_image_alt"),
  paymentInstructions: text("payment_instructions"),
  open: integer("open", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const payments = sqliteTable(
  "payments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    type: text("type", { enum: ["donation", "sponsorship", "membership_fee"] }).notNull().default("donation"),
    payerName: text("payer_name").notNull(),
    payerEmail: text("payer_email").notNull(),
    memberId: integer("member_id").references(() => members.id, { onDelete: "set null" }),
    amountCentavos: integer("amount_centavos").notNull(),
    method: text("method", { enum: ["gcash", "maya", "bank"] }).notNull(),
    referenceNo: text("reference_no").notNull(),
    proofUrl: text("proof_url"),
    consent: integer("consent", { mode: "boolean" }).notNull(),
    status: text("status", { enum: ["pending", "confirmed", "rejected"] }).notNull().default("pending"),
    confirmedBy: text("confirmed_by"),
    confirmedAt: text("confirmed_at"),
    note: text("note"),
    createdAt: text("created_at").notNull(),
  },
  // A rejected pledge frees its reference so the payer can resubmit a corrected one.
  (t) => [uniqueIndex("payments_method_reference").on(t.method, t.referenceNo).where(sql`status <> 'rejected'`)],
);

export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "set null" }),
  campaignId: integer("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
  amountCentavos: integer("amount_centavos").notNull(),
  description: text("description").notNull(),
  spentOn: text("spent_on").notNull(),
  receiptUrl: text("receipt_url"),
  recordedBy: text("recorded_by"),
  createdAt: text("created_at").notNull(),
});

export const eventsLog = sqliteTable("events_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  criterion: text("criterion").notNull(),
  actor: text("actor").notNull().default("public"),
  refTable: text("ref_table"),
  refId: integer("ref_id"),
  meta: text("meta"),
  createdAt: text("created_at").notNull(),
});

// Who changed what in the admin area, newest first on /admin/activity.
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    targetTable: text("target_table"),
    targetId: integer("target_id"),
    summary: text("summary").notNull(),
    details: text("details"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [index("audit_log_created_at").on(t.createdAt)],
);

export const passportEntries = sqliteTable(
  "passport_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    memberId: integer("member_id").notNull().references(() => members.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["training", "project_led", "project_joined", "award", "position"] }).notNull(),
    title: text("title").notNull(),
    date: text("date").notNull(),
    points: integer("points").notNull(),
    note: text("note"),
    refTable: text("ref_table"),
    refId: integer("ref_id"),
    status: text("status", { enum: ["requested", "verified", "declined"] }).notNull().default("requested"),
    requestedBy: text("requested_by"),
    verifiedBy: text("verified_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [uniqueIndex("passport_entries_ref").on(t.refTable, t.refId)],
);

export const projectMetrics = sqliteTable(
  "project_metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    value: integer("value").notNull(),
  },
  (t) => [uniqueIndex("project_metrics_project_metric").on(t.projectId, t.metric)],
);

export const analyticsSnapshots = sqliteTable("analytics_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  month: text("month").notNull().unique(),
  organicClicks: integer("organic_clicks"),
  impressions: integer("impressions"),
  visitors: integer("visitors"),
  note: text("note"),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at").notNull(),
});

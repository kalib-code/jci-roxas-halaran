import { z } from "zod";

const BLOB_URL = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i;
const QR_URL = /^(https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/|\/assets\/)/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const email = z.string().trim().toLowerCase().email("Enter a valid email address");
const consent = z.literal(true, { errorMap: () => ({ message: "Please agree to the privacy notice" }) });
const text = (max) => z.string().trim().max(max).default("");
const name = (msg) => z.string().trim().min(2, msg).max(120);
const optionalId = z
  .preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int().positive().nullable())
  .default(null);
const pesos = z.coerce.number({ invalid_type_error: "Enter the amount" }).positive("Enter the amount").max(10_000_000);

export const toCentavos = (p) => Math.round(p * 100);

export const applicationInput = z.object({
  name: name("Enter your full name"),
  email,
  phone: text(30),
  birthdate: z.string().regex(DATE, "Enter your birthdate"),
  barangay: text(120),
  whyJoin: text(1000),
  referredBy: text(120),
  consent,
});

export const rsvpInput = z.object({
  eventId: z.coerce.number().int().positive(),
  name: name("Enter your name"),
  email,
  phone: text(30),
  consent,
});

export const volunteerInput = z
  .object({ projectId: optionalId, eventId: optionalId, name: name("Enter your name"), email, phone: text(30), skills: text(300), consent })
  .refine((v) => v.projectId || v.eventId, { message: "Choose a project or event" });

export const pledgeInput = z.object({
  campaignId: optionalId,
  type: z.enum(["donation", "sponsorship", "membership_fee"]).default("donation"),
  payerName: name("Enter your name"),
  payerEmail: email,
  amountPesos: pesos,
  method: z.enum(["gcash", "maya", "bank"], { errorMap: () => ({ message: "Choose how you paid" }) }),
  referenceNo: z.string().trim().toUpperCase().min(4, "Enter the reference number from your receipt").max(40),
  proofUrl: z.string().trim().regex(BLOB_URL).or(z.literal("")).default(""),
  consent,
});

export const eventInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  slug: text(120),
  descriptionHtml: z.string().default(""),
  descriptionJson: z.string().default(""),
  startAt: z.string().regex(DATETIME, "Pick a start date and time"),
  endAt: z.string().regex(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})?$/, "Pick an end date and time").default(""),
  venue: text(200),
  capacity: z
    .preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int().positive().nullable())
    .default(null),
  rsvpOpen: z.boolean().default(true),
  projectId: optionalId,
  coverUrl: text(500),
  coverAlt: text(200),
});

export const campaignInput = z.object({
  title: z.string().trim().min(1, "Add a title").max(160),
  slug: text(120),
  description: text(1000),
  projectId: optionalId,
  goalPesos: pesos,
  qrImageUrl: z.string().trim().regex(QR_URL, "Upload the QR image").or(z.literal("")).default(""),
  qrImageAlt: text(200),
  paymentInstructions: text(500),
  open: z.boolean().default(true),
});

export const expenseInput = z.object({
  amountPesos: pesos,
  description: z.string().trim().min(1, "Describe the expense").max(300),
  spentOn: z.string().regex(DATE, "Pick the date"),
  projectId: optionalId,
  campaignId: optionalId,
  receiptUrl: z.string().trim().regex(BLOB_URL).or(z.literal("")).default(""),
});

import { z } from "zod";

export const PHONE_MESSAGE = "Enter a Philippine number, e.g. 0917 123 4567";
export const LINK_MESSAGE = "Use a full https:// link";
export const CONSENT_MESSAGE = "Tick the consent box to publish your card";

const MOBILE = /^(?:\+?63|0)(9\d{9})$/;
const LANDLINE = /^(?:\+?63|0)([2-8]\d{7,9})$/;

// "0917 123 4567", "+63 917-123-4567", "(033) 621 1234" → "+639171234567" / "+63336211234".
// Returns "" for blank input and null for anything that isn't a Philippine number.
export function normalizePhone(input) {
  const digits = String(input ?? "").replace(/[\s\-().]/g, "");
  if (!digits) return "";
  const m = digits.match(MOBILE) ?? digits.match(LANDLINE);
  return m ? `+63${m[1]}` : null;
}

export const phoneField = z
  .string()
  .trim()
  .max(30)
  .default("")
  .transform((v, ctx) => {
    const phone = normalizePhone(v);
    if (phone === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: PHONE_MESSAGE });
      return z.NEVER;
    }
    return phone;
  });

// Parse with the same URL parser browsers use and store its normalised form, so the link
// that was validated is exactly the link every later reader (browser, vCard app) sees.
export function safeLink(input) {
  const value = String(input ?? "").trim();
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) return null;
  return url.href.length <= 300 ? url.href : null;
}

export const linkField = z
  .string()
  .trim()
  .max(300, LINK_MESSAGE)
  .default("")
  .transform((v, ctx) => {
    const link = safeLink(v);
    if (link === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: LINK_MESSAGE });
      return z.NEVER;
    }
    return link;
  });

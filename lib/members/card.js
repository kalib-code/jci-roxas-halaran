import { z } from "zod";
import { safeLink, platformFor, cleanLabel, MAX_LINKS } from "./card-view.js";

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

const linkRow = z.object({
  url: z.string().trim().max(300, LINK_MESSAGE).default(""),
  label: z.string().max(80).default(""),
});

// The member's own list of links. Blank rows (the editor's empty "Add a link" row) are
// dropped, repeats are kept once, and a missing label is filled from the site's name.
export const linksField = z
  .array(linkRow)
  .max(MAX_LINKS, `Add up to ${MAX_LINKS} links`)
  .transform((rows, ctx) => {
    const out = [];
    for (const [i, row] of rows.entries()) {
      const url = safeLink(row.url);
      if (url === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Link ${i + 1}: ${LINK_MESSAGE}` });
        return z.NEVER;
      }
      if (url && !out.some((l) => l.url === url)) out.push({ label: cleanLabel(row.label) || platformFor(url).label, url });
    }
    return out;
  });

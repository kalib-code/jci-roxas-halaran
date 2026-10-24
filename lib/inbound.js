// Mail sent to info@ arrives through Resend Receiving as an `email.received`
// webhook; this forwards it to the board. Recipients live in INFO_FORWARD_TO
// (comma-separated) so personal addresses stay out of this public repo.

import sanitizeHtml from "sanitize-html";

// The addr-spec of "Name <a@b>" or "a@b": the last <...> at the end only, so a
// display name like "<info@...>" can't stand in for the real address.
const addressOf = (value) => (String(value).match(/<([^<>]+)>\s*$/)?.[1] ?? String(value)).trim().toLowerCase();

// The forward leaves from our own domain, so the board will trust it: keep
// formatting and links, drop scripts, forms, styles and remote images
// (tracking pixels). Inline images arrive as data: URIs and are kept.
const cleanMail = (html) =>
  sanitizeHtml(html ?? "", {
    allowedTags: ["p", "br", "div", "span", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "blockquote", "h1", "h2", "h3", "h4", "hr", "pre", "code", "table", "thead", "tbody", "tr", "td", "th", "img"],
    allowedAttributes: { a: ["href"], img: ["src", "alt"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
  });

// Attachments a board member might open from a "trusted" sender: refuse the
// ones that run code, and keep the total small.
const BLOCKED_EXT = /\.(exe|scr|com|bat|cmd|msi|ps1|vbs|vbe|js|jse|wsf|hta|lnk|iso|img|jar|apk|docm|xlsm|pptm|dotm|xlam)$/i;
const MAX_FILES = 10;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const safeName = (name) => String(name ?? "attachment").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069/\\]/g, "_").slice(0, 120) || "attachment";

export function pickAttachments(list) {
  const kept = [];
  const dropped = [];
  let total = 0;
  for (const a of list) {
    if (a.content_disposition === "inline") continue;
    const name = safeName(a.filename);
    if (BLOCKED_EXT.test(name) || kept.length >= MAX_FILES || total + (a.size ?? 0) > MAX_TOTAL_BYTES) {
      dropped.push(name);
      continue;
    }
    total += a.size ?? 0;
    kept.push({ filename: name, path: a.download_url, contentType: a.content_type });
  }
  return { kept, dropped };
}

export const parseRecipients = (value) =>
  String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// What to do with one webhook event: { skip: reason } or { forward: true }.
export function shouldForward(event, { infoAddress, from, recipients }) {
  if (event?.type !== "email.received") return { skip: "not-an-inbound-email" };
  if (!recipients.length) return { skip: "no-recipients-configured" };
  const d = event.data ?? {};
  // received_for is the envelope recipient the mail server saw; To/Cc are
  // whatever the sender typed, so they count only when the envelope is missing.
  const addressedTo = (d.received_for?.length ? d.received_for : [...(d.to ?? []), ...(d.cc ?? [])]).map(addressOf);
  if (!addressedTo.includes(infoAddress.toLowerCase())) return { skip: "not-for-info" };
  // Never forward our own forwards (a board member replying-all, a bounce loop).
  if (addressOf(d.from) === addressOf(from)) return { skip: "own-message" };
  return { forward: true };
}

// The forwarded copy: sent from our domain (so it passes SPF/DKIM), with
// Reply-To set to the original sender so the board's replies go to them.
export function buildForward(email, attachments, { from, recipients }) {
  const { kept, dropped } = pickAttachments(attachments);
  const sender = email.from;
  const when = email.created_at ? new Date(email.created_at).toUTCString() : "";
  const note = dropped.length ? `Not forwarded for safety (open it in the Resend inbox if needed): ${dropped.join(", ")}\n` : "";
  const header = `External email sent to info@, forwarded automatically. Check the sender before clicking links.\n${note}---------- Forwarded message ----------\nFrom: ${sender}\nDate: ${when}\nSubject: ${email.subject ?? ""}\nTo: ${(email.to ?? []).join(", ")}\n\n`;
  return {
    from,
    to: recipients,
    replyTo: email.reply_to?.length ? email.reply_to : [sender],
    subject: /^fwd?:/i.test(email.subject ?? "") ? email.subject : `Fwd: ${email.subject ?? "(no subject)"}`,
    text: header + (email.text ?? ""),
    html: email.html
      ? `<p style="color:#555">${escapeHtml(header).replace(/\n/g, "<br>")}</p>${cleanMail(email.html)}`
      : undefined,
    attachments: kept.length ? kept : undefined,
  };
}

// Verifies, filters and forwards one webhook request. `resend` is the SDK client.
export async function handleInbound(rawBody, headers, { resend, webhookSecret, infoAddress, from, recipients }) {
  let event;
  try {
    event = resend.webhooks.verify({ payload: rawBody, headers, webhookSecret });
  } catch {
    return { status: 401, body: { error: "Invalid signature" } };
  }
  const decision = shouldForward(event, { infoAddress, from, recipients });
  if (decision.skip) return { status: 200, body: { skipped: decision.skip } };

  const emailId = event.data.email_id;
  const { data: email, error } = await resend.emails.receiving.get(emailId);
  if (error) return { status: 502, body: { error: `Couldn't load the email: ${error.message}` } };
  const { data: list } = await resend.emails.receiving.attachments.list({ emailId });
  const message = buildForward(email, list?.data ?? [], { from, recipients });
  // Resend retries webhooks; the idempotency key keeps a retry from sending twice.
  const sent = await resend.emails.send(message, { idempotencyKey: `info-forward/${emailId}` });
  if (sent.error) return { status: 502, body: { error: `Couldn't forward: ${sent.error.message}` } };
  return { status: 200, body: { forwarded: sent.data?.id ?? true } };
}

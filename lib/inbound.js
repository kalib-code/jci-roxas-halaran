// Mail sent to info@ arrives through Resend Receiving as an `email.received`
// webhook; this forwards it to the board. Recipients live in INFO_FORWARD_TO
// (comma-separated) so personal addresses stay out of this public repo.

const addressOf = (value) => (String(value).match(/<([^>]+)>/)?.[1] ?? String(value)).trim().toLowerCase();

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
  const addressedTo = [...(d.to ?? []), ...(d.cc ?? []), ...(d.received_for ?? [])].map(addressOf);
  if (!addressedTo.includes(infoAddress.toLowerCase())) return { skip: "not-for-info" };
  // Never forward our own forwards (a board member replying-all, a bounce loop).
  if (addressOf(d.from) === addressOf(from)) return { skip: "own-message" };
  return { forward: true };
}

// The forwarded copy: sent from our domain (so it passes SPF/DKIM), with
// Reply-To set to the original sender so the board's replies go to them.
export function buildForward(email, attachments, { from, recipients }) {
  // Inline images already sit in `html` as data URIs, so only real attachments go along.
  const files = attachments.filter((a) => a.content_disposition !== "inline");
  const sender = email.from;
  const when = email.created_at ? new Date(email.created_at).toUTCString() : "";
  const header = `---------- Forwarded message ----------\nFrom: ${sender}\nDate: ${when}\nSubject: ${email.subject ?? ""}\nTo: ${(email.to ?? []).join(", ")}\n\n`;
  return {
    from,
    to: recipients,
    replyTo: email.reply_to?.length ? email.reply_to : [sender],
    subject: /^fwd?:/i.test(email.subject ?? "") ? email.subject : `Fwd: ${email.subject ?? "(no subject)"}`,
    text: header + (email.text ?? ""),
    html: email.html
      ? `<p style="color:#555">${escapeHtml(header).replace(/\n/g, "<br>")}</p>${email.html}`
      : undefined,
    attachments: files.length
      ? files.map((a) => ({ filename: a.filename, path: a.download_url, contentType: a.content_type }))
      : undefined,
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

import { describe, it, expect, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { Resend } from "resend";
import { handleInbound, shouldForward, buildForward, parseRecipients, pickAttachments } from "@/lib/inbound.js";

const opts = { infoAddress: "info@jciroxashalaran.com", from: "JCI Roxas Halaran <forwarder@jciroxashalaran.com>", recipients: ["sec@x.ph", "pres@x.ph"] };
const received = (data = {}) => ({
  type: "email.received",
  data: { email_id: "em_1", from: "Ana <ana@gmail.com>", to: ["info@jciroxashalaran.com"], cc: [], received_for: [], subject: "Sponsorship", ...data },
});

function fakeResend(event, { email = {}, attachments = [], sendError = null } = {}) {
  return {
    webhooks: { verify: vi.fn(() => { if (!event) throw new Error("bad sig"); return event; }) },
    emails: {
      receiving: {
        get: vi.fn(async () => ({ data: { from: "Ana <ana@gmail.com>", to: ["info@jciroxashalaran.com"], subject: "Sponsorship", text: "Hello", html: "<p>Hello</p>", reply_to: null, created_at: "2026-10-24T01:00:00Z", ...email }, error: null })),
        attachments: { list: vi.fn(async () => ({ data: { data: attachments }, error: null })) },
      },
      send: vi.fn(async () => (sendError ? { data: null, error: { message: sendError } } : { data: { id: "out_1" }, error: null })),
    },
  };
}

describe("info@ forwarding", () => {
  it("reads a comma-separated recipient list", () => {
    expect(parseRecipients(" sec@x.ph, pres@x.ph ,,")).toEqual(["sec@x.ph", "pres@x.ph"]);
    expect(parseRecipients(undefined)).toEqual([]);
  });

  it("forwards only inbound mail addressed to info@, case-insensitively and in any field", () => {
    expect(shouldForward(received(), opts)).toEqual({ forward: true });
    expect(shouldForward(received({ to: ["Halaran <INFO@jciroxashalaran.com>"] }), opts)).toEqual({ forward: true });
    expect(shouldForward(received({ to: ["x@y.ph"], received_for: ["info@jciroxashalaran.com"] }), opts)).toEqual({ forward: true });
    expect(shouldForward(received({ to: ["hello@jciroxashalaran.com"] }), opts)).toEqual({ skip: "not-for-info" });
    expect(shouldForward({ type: "email.delivered", data: {} }, opts)).toEqual({ skip: "not-an-inbound-email" });
    expect(shouldForward(received(), { ...opts, recipients: [] })).toEqual({ skip: "no-recipients-configured" });
    expect(shouldForward(received({ from: "forwarder@jciroxashalaran.com" }), opts)).toEqual({ skip: "own-message" });
  });

  it("trusts the envelope recipient over typed headers, and can't be fooled by a display name", () => {
    expect(shouldForward(received({ to: ["info@jciroxashalaran.com"], received_for: ["other@jciroxashalaran.com"] }), opts)).toEqual({ skip: "not-for-info" });
    expect(shouldForward(received({ to: ['"<info@jciroxashalaran.com>" <evil@x.ph>'] }), opts)).toEqual({ skip: "not-for-info" });
  });

  it("strips scripts, forms, styles and remote images from forwarded HTML", () => {
    const msg = buildForward(
      { from: "a@x.ph", to: [], subject: "s", html: '<p style="x">Hi</p><script>alert(1)</script><form action="https://evil"><input></form><img src="https://track/p.gif"><img src="data:image/png;base64,AA"><a href="javascript:x">j</a><a href="https://ok.ph">ok</a>' },
      [],
      opts,
    );
    const body = msg.html.slice(msg.html.indexOf("</p>") + 4);
    expect(body).not.toMatch(/script|form|style=|track\/p\.gif|javascript:/);
    expect(msg.html).toContain('<img src="data:image/png;base64,AA" />');
    expect(msg.html).toContain('<a href="https://ok.ph">ok</a>');
    expect(msg.text).toContain("External email sent to info@");
  });

  it("drops attachments that run code or exceed the limits, and cleans file names", () => {
    const a = (filename, size = 1000) => ({ filename, size, download_url: `https://dl/${filename}`, content_type: "application/octet-stream", content_disposition: "attachment" });
    const { kept, dropped } = pickAttachments([a("deck.pdf"), a("invoice.exe"), a("budget.xlsm"), a("big.zip", 30 * 1024 * 1024), a("evil\u202efdp.js")]);
    expect(kept.map((k) => k.filename)).toEqual(["deck.pdf"]);
    expect(dropped).toEqual(["invoice.exe", "budget.xlsm", "big.zip", "evil_fdp.js"]);
    const many = pickAttachments([...Array(12)].map((_, i) => a(`f${i}.pdf`)));
    expect(many.kept).toHaveLength(10);
  });

  it("sends from our domain with Reply-To set to the original sender", () => {
    const msg = buildForward(
      { from: "Ana <ana@gmail.com>", to: ["info@jciroxashalaran.com"], subject: "Sponsorship", text: "Hello", html: "<p>Hi <b>there</b></p>", created_at: "2026-10-24T01:00:00Z" },
      [{ filename: "deck.pdf", download_url: "https://dl/1", content_type: "application/pdf", content_disposition: "attachment" }, { filename: "logo.png", download_url: "https://dl/2", content_disposition: "inline" }],
      opts,
    );
    expect(msg).toMatchObject({ from: opts.from, to: opts.recipients, replyTo: ["Ana <ana@gmail.com>"], subject: "Fwd: Sponsorship" });
    expect(msg.text).toContain("From: Ana <ana@gmail.com>");
    expect(msg.text.endsWith("Hello")).toBe(true);
    expect(msg.html).toContain("From: Ana &lt;ana@gmail.com&gt;");
    expect(msg.attachments).toEqual([{ filename: "deck.pdf", path: "https://dl/1", contentType: "application/pdf" }]);
  });

  it("forwards a verified event once per email, keyed for webhook retries", async () => {
    const resend = fakeResend(received());
    const r = await handleInbound("{}", {}, { resend, webhookSecret: "s", ...opts });
    expect(r).toEqual({ status: 200, body: { forwarded: "out_1" } });
    expect(resend.emails.send.mock.calls[0][1]).toEqual({ idempotencyKey: "info-forward/em_1" });
  });

  it("rejects a bad signature without touching the mailbox", async () => {
    const resend = fakeResend(null);
    expect((await handleInbound("{}", {}, { resend, webhookSecret: "s", ...opts })).status).toBe(401);
    expect(resend.emails.receiving.get).not.toHaveBeenCalled();
  });

  it("reports a failed send as 502 so Resend retries", async () => {
    const resend = fakeResend(received(), { sendError: "domain not verified" });
    expect(await handleInbound("{}", {}, { resend, webhookSecret: "s", ...opts })).toEqual({ status: 502, body: { error: "Couldn't forward: domain not verified" } });
  });

  it("accepts a payload signed the way Resend signs webhooks", async () => {
    const key = randomBytes(24);
    const payload = JSON.stringify(received({ to: ["hello@jciroxashalaran.com"] }));
    const id = "msg_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64")}`;
    const resend = new Resend("re_test");
    const ok = await handleInbound(payload, { id, timestamp, signature }, { resend, webhookSecret: `whsec_${key.toString("base64")}`, ...opts });
    expect(ok).toEqual({ status: 200, body: { skipped: "not-for-info" } });
    const forged = await handleInbound(payload, { id, timestamp, signature: "v1,AAAA" }, { resend, webhookSecret: `whsec_${key.toString("base64")}`, ...opts });
    expect(forged.status).toBe(401);
  });
});

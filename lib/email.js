// Best-effort email through Resend. Never throws; callers treat failures as
// notes, never as a reason to undo a save.
export async function sendEmail(
  { to, subject, text, attachments },
  { apiKey = process.env.RESEND_API_KEY, from = process.env.EMAIL_FROM ?? "JCI Roxas Halaran <onboarding@resend.dev>", fetchImpl = fetch } = {},
) {
  if (!apiKey) return { sent: false, reason: "not-configured" };
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      // attachments: [{ filename, content }] with content base64-encoded.
      body: JSON.stringify({ from, to, subject, text, ...(attachments?.length ? { attachments } : {}) }),
    });
    return res.ok ? { sent: true } : { sent: false, reason: `http-${res.status}` };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

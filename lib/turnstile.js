// Cloudflare Turnstile server check. With no secret configured, local dev,
// e2e and previews pass; production fails closed so a missing variable never
// turns the bot check off. TURNSTILE_HOSTNAMES (comma-separated) limits which
// sites a solved token may come from; empty skips that check.
const MAX_TOKEN = 2048;

export async function verifyTurnstile(
  token,
  {
    secret = process.env.TURNSTILE_SECRET_KEY,
    environment = process.env.VERCEL_ENV,
    hostnames = process.env.TURNSTILE_HOSTNAMES,
    fetchImpl = fetch,
  } = {},
) {
  if (!secret) {
    if (environment === "production") {
      console.error("TURNSTILE_SECRET_KEY is not set in production; refusing form submissions.");
      return false;
    }
    return true;
  }
  if (!token || token.length > MAX_TOKEN) return false;
  const allowed = (hostnames ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    if (data.success !== true) return false;
    return allowed.length === 0 || allowed.includes(String(data.hostname ?? "").toLowerCase());
  } catch {
    return false;
  }
}

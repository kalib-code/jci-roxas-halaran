// Cloudflare Turnstile server check. With no secret configured, local dev,
// e2e and previews pass; production fails closed so a missing variable never
// turns the bot check off.
export async function verifyTurnstile(
  token,
  { secret = process.env.TURNSTILE_SECRET_KEY, environment = process.env.VERCEL_ENV, fetchImpl = fetch } = {},
) {
  if (!secret) {
    if (environment === "production") {
      console.error("TURNSTILE_SECRET_KEY is not set in production; refusing form submissions.");
      return false;
    }
    return true;
  }
  if (!token) return false;
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

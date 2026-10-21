// Cloudflare Turnstile server check. With no secret configured (local dev and
// e2e) every request passes; in production the secret must be set.
export async function verifyTurnstile(token, { secret = process.env.TURNSTILE_SECRET_KEY, fetchImpl = fetch } = {}) {
  if (!secret) return true;
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

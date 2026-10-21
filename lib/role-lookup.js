import { normalizeRole, roleFromSessionClaims } from "./roles.js";

// The role normally rides in the session token (Clerk → Sessions → Customize
// session token: { "metadata": "{{user.public_metadata}}" }). If that claim is
// missing, read the user's public metadata from Clerk instead, so access does
// not silently depend on a dashboard setting.
export async function resolveRole({ userId, sessionClaims }, loadUser) {
  const fromClaims = roleFromSessionClaims(sessionClaims);
  if (fromClaims || !userId) return fromClaims;
  try {
    const user = await loadUser(userId);
    return normalizeRole(user?.publicMetadata?.role);
  } catch {
    return null;
  }
}

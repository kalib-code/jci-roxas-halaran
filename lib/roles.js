export const ROLES = ["member", "officer", "treasurer", "admin"];

const AREA_ROLES = {
  members: ["member", "officer", "treasurer", "admin"],
  admin: ["officer", "treasurer", "admin"],
  content: ["admin"],
};

export function normalizeRole(value) {
  return ROLES.includes(value) ? value : null;
}

export function canAccess(role, area) {
  const r = normalizeRole(role);
  return r !== null && (AREA_ROLES[area] ?? []).includes(r);
}

// Clerk exposes public metadata in the session token as `metadata`
// (Sessions → Customize session token: { "metadata": "{{user.public_metadata}}" }).
export function roleFromSessionClaims(claims) {
  return normalizeRole(claims?.metadata?.role);
}

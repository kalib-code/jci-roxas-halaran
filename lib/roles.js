export const ROLES = ["member", "officer", "treasurer", "admin"];

const AREA_ROLES = {
  members: ["member", "officer", "treasurer", "admin"],
  admin: ["officer", "treasurer", "admin"],
};

export function normalizeRole(value) {
  return ROLES.includes(value) ? value : null;
}

export function canAccess(role, area) {
  const r = normalizeRole(role);
  return r !== null && (AREA_ROLES[area] ?? []).includes(r);
}

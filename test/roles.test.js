import { describe, it, expect } from "vitest";
import { canAccess, normalizeRole, roleFromSessionClaims } from "@/lib/roles.js";

describe("normalizeRole", () => {
  it("accepts known roles and rejects anything else", () => {
    expect(normalizeRole("treasurer")).toBe("treasurer");
    expect(normalizeRole("superuser")).toBeNull();
    expect(normalizeRole(undefined)).toBeNull();
  });
});

describe("canAccess", () => {
  it("lets every role into the members area", () => {
    for (const r of ["member", "officer", "treasurer", "admin"]) expect(canAccess(r, "members")).toBe(true);
  });

  it("keeps plain members and users without a role out of admin", () => {
    expect(canAccess("member", "admin")).toBe(false);
    expect(canAccess(undefined, "admin")).toBe(false);
    expect(canAccess(undefined, "members")).toBe(false);
  });

  it("lets officers, treasurers and admins into admin", () => {
    for (const r of ["officer", "treasurer", "admin"]) expect(canAccess(r, "admin")).toBe(true);
  });

  it("denies unknown areas", () => {
    expect(canAccess("admin", "billing")).toBe(false);
  });
});

describe("roleFromSessionClaims", () => {
  it("reads the role Clerk puts in the session token", () => {
    expect(roleFromSessionClaims({ metadata: { role: "officer" } })).toBe("officer");
  });

  it("returns null for signed-out users, missing metadata or unknown roles", () => {
    expect(roleFromSessionClaims(null)).toBeNull();
    expect(roleFromSessionClaims({})).toBeNull();
    expect(roleFromSessionClaims({ metadata: { role: "owner" } })).toBeNull();
  });
});

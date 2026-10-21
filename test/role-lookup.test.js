import { describe, it, expect, vi } from "vitest";
import { resolveRole } from "@/lib/role-lookup.js";

describe("resolveRole", () => {
  it("uses the role in the session token when Clerk includes it", async () => {
    const loadUser = vi.fn();
    expect(await resolveRole({ userId: "u1", sessionClaims: { metadata: { role: "officer" } } }, loadUser)).toBe("officer");
    expect(loadUser).not.toHaveBeenCalled();
  });

  it("falls back to the user's public metadata when the session token lacks it", async () => {
    const loadUser = vi.fn(async () => ({ publicMetadata: { role: "admin" } }));
    expect(await resolveRole({ userId: "u1", sessionClaims: {} }, loadUser)).toBe("admin");
    expect(loadUser).toHaveBeenCalledWith("u1");
  });

  it("returns null for signed-out visitors and unknown roles", async () => {
    const loadUser = vi.fn(async () => ({ publicMetadata: { role: "owner" } }));
    expect(await resolveRole({ userId: null, sessionClaims: null }, loadUser)).toBeNull();
    expect(await resolveRole({ userId: "u1", sessionClaims: {} }, loadUser)).toBeNull();
  });

  it("returns null if the user lookup fails", async () => {
    const loadUser = vi.fn(async () => { throw new Error("Clerk down"); });
    expect(await resolveRole({ userId: "u1", sessionClaims: {} }, loadUser)).toBeNull();
  });
});

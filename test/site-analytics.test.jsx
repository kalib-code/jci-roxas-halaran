// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

const h = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => h.path }));
vi.stubEnv("NEXT_PUBLIC_GA_ID", "G-TEST");
const { default: SiteAnalytics, isPrivatePath, umamiBeforeSend } = await import("@/components/SiteAnalytics.jsx");

afterEach(cleanup);

describe("site analytics", () => {
  it("treats admin, member and sign-in pages as private", () => {
    expect(["/admin", "/admin/members", "/members/directory", "/sign-in"].every(isPrivatePath)).toBe(true);
    expect(["/", "/articles/capiz-shells", "/membership", "/administration"].some(isPrivatePath)).toBe(false);
  });

  it("drops Umami events from private pages, whether the url is a path or a full URL", () => {
    expect(umamiBeforeSend("event", { url: "/members/directory?q=judy" })).toBe(false);
    expect(umamiBeforeSend("event", { url: "https://www.jciroxashalaran.com/admin" })).toBe(false);
    expect(umamiBeforeSend("event", { url: "/articles/capiz-shells" })).toEqual({ url: "/articles/capiz-shells" });
  });

  it("switches Google Analytics off on private pages and back on for public ones", () => {
    h.path = "/admin/members";
    render(<SiteAnalytics />);
    expect(window["ga-disable-G-TEST"]).toBe(true);
    cleanup();
    h.path = "/articles";
    render(<SiteAnalytics />);
    expect(window["ga-disable-G-TEST"]).toBe(false);
  });
});

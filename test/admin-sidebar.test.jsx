// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { adminNav } from "@/lib/admin/nav.js";
import { memberNav } from "@/lib/members/nav.js";

const h = vi.hoisted(() => ({ path: "/admin/payments/12" }));
vi.mock("next/navigation", () => ({ usePathname: () => h.path }));
const { default: SideNav } = await import("@/components/SideNav.jsx");

afterEach(cleanup);

describe("SideNav", () => {
  it("marks the current admin section and shows waiting counts", () => {
    h.path = "/admin/payments/12";
    render(<SideNav groups={adminNav("admin", { payments: 3 })} ariaLabel="Admin"><a href="/">View site</a></SideNav>);
    expect(screen.getByRole("navigation", { name: "Admin" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Payments 3 waiting" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Money")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View site" }).getAttribute("href")).toBe("/");
  });

  it("renders the members links with Home current only on /members", () => {
    h.path = "/members/card";
    render(<SideNav groups={memberNav()} ariaLabel="Members" />);
    expect(screen.getByRole("link", { name: "My card" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
  });
});

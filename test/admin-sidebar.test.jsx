// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { adminNav } from "@/lib/admin/nav.js";

const h = vi.hoisted(() => ({ path: "/admin/payments/12" }));
vi.mock("next/navigation", () => ({ usePathname: () => h.path }));
const { default: AdminSidebar } = await import("@/components/admin/AdminSidebar.jsx");

afterEach(cleanup);

describe("AdminSidebar", () => {
  it("marks the current section and shows waiting counts", () => {
    render(<AdminSidebar groups={adminNav("admin", { payments: 3 })} role="admin" />);
    const payments = screen.getByRole("link", { name: "Payments 3 waiting" });
    expect(payments.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByText("Money")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View site" }).getAttribute("href")).toBe("/");
  });
});

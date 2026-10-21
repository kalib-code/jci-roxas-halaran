// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const h = vi.hoisted(() => ({ path: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => h.path }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: Nav } = await import("@/components/Nav.jsx");

afterEach(cleanup);

describe("Nav", () => {
  it("shows the site menu on normal pages", () => {
    h.path = "/projects";
    render(<Nav />);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
  });

  it("stays out of the way on e-calling card pages", () => {
    h.path = "/card/lemuel-capa";
    const { container } = render(<Nav />);
    expect(container.innerHTML).toBe("");
  });
});

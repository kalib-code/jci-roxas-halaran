// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { NAV_LINKS, FOOTER_COLUMNS, STATIC_ROUTES } from "@/lib/routes.js";
import { STRINGS } from "@/lib/i18n.js";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: SiteFooter } = await import("@/components/SiteFooter.jsx");

afterEach(cleanup);

const hasBoth = (keys) => {
  for (const lang of ["en", "hil"]) for (const k of keys) expect(STRINGS[lang][k], `${lang} ${k}`).toBeTypeOf("string");
};

describe("navigation", () => {
  it("reaches Support and Impact and no longer repeats Join", () => {
    expect(NAV_LINKS.map((l) => l.href)).toEqual(["/about", "/projects", "/events", "/impact", "/articles", "/support"]);
  });

  it("only links the footer to real public pages", () => {
    for (const col of FOOTER_COLUMNS) for (const [href] of col.links) expect(STATIC_ROUTES).toContain(href);
  });
});

describe("SiteFooter", () => {
  it("groups links into three labelled columns", () => {
    render(<SiteFooter cta={false} />);
    const accountability = screen.getByRole("navigation", { name: "Accountability" });
    expect(within(accountability).getByRole("link", { name: "Transparency" }).getAttribute("href")).toBe("/transparency");
    expect(screen.getByRole("navigation", { name: "Get involved" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Chapter" })).toBeTruthy();
  });

  it("links members to their login", () => {
    render(<SiteFooter cta={false} />);
    expect(screen.getByRole("link", { name: "Member login" }).getAttribute("href")).toBe("/members");
  });

  it("has the column headings in both languages", () => {
    hasBoth(["footer.chapter", "footer.involved", "footer.accountability"]);
  });
});

describe("join steps", () => {
  it("are written in both languages", () => {
    hasBoth(["join.stepsTitle", "join.step1", "join.step2", "join.step3", "join.step4"]);
  });
});

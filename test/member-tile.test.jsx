// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: MemberCard } = await import("@/components/members/MemberCard.jsx");

afterEach(cleanup);

describe("MemberCard tile", () => {
  it("shows up to four skill chips and a card link when published", () => {
    render(<MemberCard member={{ slug: "ana", name: "Ana Cruz", photoUrl: null, profession: "Architect", business: null, skills: "A, B, C, D, E", cardPublished: true }} />);
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["A", "B", "C", "D"]);
    expect(screen.getByRole("link", { name: "View Ana Cruz's card" }).getAttribute("href")).toBe("/card/ana");
  });

  it("has no card link when unpublished", () => {
    render(<MemberCard member={{ slug: "ana", name: "Ana Cruz", photoUrl: null, skills: null, cardPublished: false }} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

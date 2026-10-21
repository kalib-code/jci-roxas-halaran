// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import OfficerCard from "@/components/OfficerCard.jsx";
import ProjectCard from "@/components/ProjectCard.jsx";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));

afterEach(cleanup);

describe("OfficerCard", () => {
  it("shows the photo when there is one", () => {
    render(<OfficerCard officer={{ name: "Jasper L. Sayo", role: "Vice President", photoUrl: "/a.jpg" }} />);
    expect(screen.getByRole("img", { name: "Jasper L. Sayo" })).toBeTruthy();
  });

  it("shows initials instead of a broken image when there is no photo", () => {
    const { container } = render(
      <OfficerCard officer={{ name: "Judy Daliva", role: "Director", photoUrl: null }} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("JD")).toBeTruthy();
    expect(screen.getByText("Judy Daliva")).toBeTruthy();
  });
});

describe("ProjectCard", () => {
  it("shows cover and formatted date", () => {
    render(
      <ProjectCard
        project={{ slug: "x", title: "IRONMEN Awards 2025", startDate: "2025-07-08", coverUrl: "/i.jpg", coverAlt: "Ceremony" }}
      />,
    );
    expect(screen.getByRole("img", { name: "Ceremony" })).toBeTruthy();
    expect(screen.getByText("July 8, 2025")).toBeTruthy();
  });

  it("shows a placeholder and no date when they are missing", () => {
    const { container } = render(<ProjectCard project={{ slug: "x", title: "SA DAGAT", startDate: null, coverUrl: null }} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".project__placeholder")).toBeTruthy();
    expect(container.querySelector("time")).toBeNull();
  });
});

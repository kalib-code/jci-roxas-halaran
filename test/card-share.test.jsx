// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CardShare from "@/components/members/CardShare.jsx";

afterEach(() => {
  cleanup();
  delete navigator.share;
});

describe("CardShare", () => {
  it("copies the link when the browser can't share", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(<CardShare url="https://site.ph/card/ana" slug="ana" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("status")).toHaveProperty("textContent", "Link copied");
    expect(writeText).toHaveBeenCalledWith("https://site.ph/card/ana");
    expect(screen.getByRole("link", { name: "Download image" }).getAttribute("href")).toBe("/card/ana/image.png");
  });

  it("uses the phone's share sheet when there is one", async () => {
    navigator.share = vi.fn(async () => {});
    render(<CardShare url="https://site.ph/card/ana" slug="ana" />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await Promise.resolve();
    expect(navigator.share).toHaveBeenCalledWith({ title: "My e-calling card", url: "https://site.ph/card/ana" });
  });
});

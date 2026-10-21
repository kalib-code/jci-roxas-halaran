// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: ECard } = await import("@/components/members/ECard.jsx");

afterEach(cleanup);

const card = {
  slug: "ana-cruz", name: "Ana Cruz", roleLine: "Member since 2024", profession: "Architect", business: "Studio",
  photoUrl: null, bio: "Hi", phone: null, email: "ana@x.ph", links: [{ label: "LinkedIn", url: "https://linkedin.com/in/ana" }],
};

describe("ECard", () => {
  it("shows only the actions the member allowed", () => {
    render(<ECard card={card} />);
    expect(screen.queryByRole("link", { name: "Call" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Text" })).toBeNull();
    expect(screen.getByRole("link", { name: "Email" }).getAttribute("href")).toBe("mailto:ana@x.ph");
    expect(screen.getByRole("link", { name: "Save contact" }).getAttribute("href")).toBe("/card/ana-cruz/vcard");
    expect(screen.getByRole("link", { name: "LinkedIn" }).getAttribute("href")).toBe("https://linkedin.com/in/ana");
    expect(screen.getByText("AC")).toBeTruthy();
  });

  it("adds call and text when the phone is shown, and the QR when given", () => {
    render(<ECard card={{ ...card, phone: "+639171234567" }} qrSvg="<svg></svg>" nameAs="h1" />);
    expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+639171234567");
    expect(screen.getByRole("link", { name: "Text" }).getAttribute("href")).toBe("sms:+639171234567");
    expect(screen.getByRole("img", { name: "QR code for this card" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Ana Cruz" })).toBeTruthy();
  });
});

describe("ECard before publishing", () => {
  it("shows Save contact as text, not a link that would 404", () => {
    render(<ECard card={card} live={false} />);
    expect(screen.queryByRole("link", { name: "Save contact" })).toBeNull();
    expect(screen.getByText("Save contact")).toBeTruthy();
  });
});

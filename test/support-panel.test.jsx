// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { STRINGS } from "@/lib/i18n.js";

vi.mock("@/app/actions/engagement.js", () => ({ rsvpAction: vi.fn(), applyAction: vi.fn(), volunteerAction: vi.fn(), pledgeAction: vi.fn() }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));
const { default: PledgePanel } = await import("@/components/forms/PledgePanel.jsx");

afterEach(cleanup);

const campaigns = [
  { id: 1, title: "Coastal Fund", qrImageUrl: "/qr.png", qrImageAlt: "GCash QR for Coastal Fund", paymentInstructions: "GCash 0917 000 0000" },
  { id: 2, title: "School Kits", qrImageUrl: null, qrImageAlt: null, paymentInstructions: null },
];

describe("PledgePanel", () => {
  it("shows the chosen campaign's QR and switches to the fallback for one without a QR", () => {
    render(<PledgePanel campaigns={campaigns} />);
    expect(screen.getByRole("img", { name: "GCash QR for Coastal Fund" })).toBeTruthy();
    expect(screen.getByText("GCash 0917 000 0000")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/payment for/i), { target: { value: "2" } });
    expect(screen.queryByRole("img", { name: "GCash QR for Coastal Fund" })).toBeNull();
    expect(screen.getByText(/Ask us for payment details/)).toBeTruthy();
  });

  it("drops the campaign QR when paying a membership fee", () => {
    render(<PledgePanel campaigns={campaigns} />);
    fireEvent.change(screen.getByLabelText(/payment for/i), { target: { value: "membership_fee" } });
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/Ask us for payment details/)).toBeTruthy();
  });

  it("has the card text in both languages", () => {
    for (const lang of ["en", "hil"]) {
      for (const k of ["support.howTitle", "support.step1", "support.step2", "support.step3", "support.noQr"]) expect(STRINGS[lang][k], `${lang} ${k}`).toBeTypeOf("string");
    }
  });
});

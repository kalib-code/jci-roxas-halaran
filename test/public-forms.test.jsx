// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const h = vi.hoisted(() => ({ rsvp: vi.fn() }));
vi.mock("@/app/actions/engagement.js", () => ({ rsvpAction: (i) => h.rsvp(i), applyAction: vi.fn(), volunteerAction: vi.fn(), pledgeAction: vi.fn() }));
vi.mock("next/script", () => ({ default: () => null }));

const { default: RsvpForm } = await import("@/components/forms/RsvpForm.jsx");
const { default: ProgressBar } = await import("@/components/ProgressBar.jsx");

afterEach(cleanup);

function fill() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ana Cruz" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@x.ph" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /RSVP/ }));
}

describe("RsvpForm", () => {
  it("shows the confirmation and hides the form on success", async () => {
    h.rsvp.mockResolvedValue({ ok: true, message: "You're going!" });
    render(<RsvpForm eventId={3} full={false} />);
    fill();
    expect((await screen.findByRole("status")).textContent).toBe("You're going!");
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(h.rsvp.mock.calls[0][0]).toMatchObject({ eventId: 3, name: "Ana Cruz", email: "a@x.ph", consent: true });
  });

  it("keeps the form and shows errors on failure", async () => {
    h.rsvp.mockResolvedValue({ ok: false, errors: ["You're already on the list for this event"] });
    render(<RsvpForm eventId={3} full={false} />);
    fill();
    expect((await screen.findByRole("alert")).textContent).toContain("already on the list");
    expect(screen.getByLabelText("Name").value).toBe("Ana Cruz");
  });

  it("says when you are joining the waitlist", () => {
    render(<RsvpForm eventId={3} full />);
    expect(screen.getByRole("button", { name: "RSVP — join the waitlist" })).toBeTruthy();
  });
});

describe("ProgressBar", () => {
  it("reports progress accessibly and caps at 100%", () => {
    render(<ProgressBar raisedCentavos={3000000} goalCentavos={2000000} label="Coastal fund" />);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByText("₱30,000 raised of ₱20,000")).toBeTruthy();
  });
});

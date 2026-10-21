// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ rsvp: vi.fn() }));
vi.mock("@/app/actions/engagement.js", () => ({ rsvpAction: (i) => h.rsvp(i), applyAction: vi.fn(), volunteerAction: vi.fn(), pledgeAction: vi.fn() }));

process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "site-key";
const { default: Turnstile } = await import("@/components/forms/Turnstile.jsx");
const { default: RsvpForm } = await import("@/components/forms/RsvpForm.jsx");

let ids;
beforeEach(() => {
  ids = 0;
  window.turnstile = {
    render: vi.fn((el, opts) => { const id = `w${ids++}`; opts.callback(`token-${id}`); return id; }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
});
afterEach(cleanup);

describe("Turnstile widget", () => {
  it("renders every widget on a page, not just the first", async () => {
    render(<><Turnstile onToken={() => {}} /><Turnstile onToken={() => {}} /></>);
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalledTimes(2));
  });

  it("asks for a fresh token when resetKey changes", async () => {
    const onToken = vi.fn();
    const { rerender } = render(<Turnstile onToken={onToken} resetKey={0} />);
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalled());
    rerender(<Turnstile onToken={onToken} resetKey={1} />);
    expect(window.turnstile.reset).toHaveBeenCalledWith("w0");
    expect(onToken).toHaveBeenLastCalledWith("");
  });
});

describe("forms with Turnstile on", () => {
  it("get a fresh token after a failed submit so the retry can pass", async () => {
    h.rsvp.mockResolvedValue({ ok: false, errors: ["You're already on the list for this event"] });
    render(<RsvpForm eventId={1} full={false} />);
    await waitFor(() => expect(window.turnstile.render).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ana Cruz" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@x.ph" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "RSVP" }));
    await screen.findByRole("alert");
    await waitFor(() => expect(window.turnstile.reset).toHaveBeenCalled());
    expect(h.rsvp.mock.calls[0][0].turnstileToken).toBe("token-w0");
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const deleteEventAction = vi.fn();
const replace = vi.fn();
vi.mock("@/app/admin/events/actions.js", () => ({ deleteEventAction: (...a) => deleteEventAction(...a) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
const { default: DeleteEvent } = await import("@/components/admin/DeleteEvent.jsx");

const event = { id: 7, title: "Test event" };
const none = { rsvps: 0, attendance: 0, certificates: 0, drives: 0 };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("deleting an event from its admin page", () => {
  it("asks first, listing what goes with it", () => {
    render(<DeleteEvent event={event} counts={{ rsvps: 3, attendance: 1, certificates: 1, drives: 1 }} />);
    expect(screen.queryByRole("button", { name: "Yes, delete it" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete event…" }));
    expect(screen.getByText("3 RSVPs")).toBeTruthy();
    expect(screen.getByText("1 attendance sheet entry and the passport points they gave")).toBeTruthy();
    expect(screen.getByText(/1 certificate already emailed/)).toBeTruthy();
    expect(screen.getByText(/Its 1 volunteer registration and the volunteers in them stay/)).toBeTruthy();
    expect(deleteEventAction).not.toHaveBeenCalled();
  });

  it("can be cancelled", () => {
    render(<DeleteEvent event={event} counts={none} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete event…" }));
    expect(screen.getByText("It has no RSVPs or attendance.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Delete event…" })).toBeTruthy();
  });

  it("deletes and goes back to the events list", async () => {
    deleteEventAction.mockResolvedValue({ ok: true });
    render(<DeleteEvent event={event} counts={none} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete event…" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/events"));
    expect(deleteEventAction).toHaveBeenCalledWith(7);
  });

  it("shows why when it can't", async () => {
    deleteEventAction.mockResolvedValue({ ok: false, errors: ["That event was already deleted"] });
    render(<DeleteEvent event={event} counts={none} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete event…" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, delete it" }));
    expect((await screen.findByRole("alert")).textContent).toContain("That event was already deleted");
    expect(replace).not.toHaveBeenCalled();
  });
});

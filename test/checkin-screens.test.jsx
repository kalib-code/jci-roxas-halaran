// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const checkInAction = vi.fn();
const actions = { setCheckinAction: vi.fn(async () => ({ ok: true })), addAttendeeAction: vi.fn(), updateAttendeeAction: vi.fn(), removeAttendeeAction: vi.fn(async () => ({ ok: true })) };
vi.mock("@/app/actions/attendance.js", () => ({ checkInAction: (...a) => checkInAction(...a) }));
vi.mock("@/app/admin/events/actions.js", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { default: CheckinForm } = await import("@/components/forms/CheckinForm.jsx");
const { default: AttendancePanel } = await import("@/components/admin/AttendancePanel.jsx");

// Node's own localStorage is undefined without a file and hides jsdom's; use a plain one.
const store = new Map();
vi.stubGlobal("localStorage", {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
});

const event = { title: "General Assembly", when: "January 15, 2027 · 6:00 PM", venue: "Roxas City Hall" };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("CheckinForm", () => {
  it("asks which chapter only for visitors from another LO, then sends the details", async () => {
    checkInAction.mockResolvedValue({ ok: true, name: "Ana Reyes", at: "Jan 15, 6:32 PM", message: "" });
    render(<CheckinForm code="abc123def456" event={event} />);
    expect(screen.queryByLabelText("Which chapter?")).toBeNull();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ana Reyes" } });
    fireEvent.click(screen.getByLabelText(/Another JCI chapter/));
    fireEvent.change(screen.getByLabelText("Which chapter?"), { target: { value: "JCI Capiz" } });
    fireEvent.change(screen.getByLabelText("Position or designation"), { target: { value: "Local President" } });
    fireEvent.click(screen.getByLabelText(/I agree that JCI Roxas Halaran may record/));
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(checkInAction).toHaveBeenCalledWith(expect.objectContaining({ code: "abc123def456", name: "Ana Reyes", affiliation: "other_lo", localOrganization: "JCI Capiz", position: "Local President", consent: true }));
    expect(screen.getByText("You're checked in")).toBeTruthy();
    expect(screen.getByText("Recorded Jan 15, 6:32 PM")).toBeTruthy();
  });

  it("remembers details only when asked, and 'someone else' starts blank", async () => {
    checkInAction.mockResolvedValue({ ok: true, name: "Judy", at: "6:00 PM" });
    localStorage.setItem("jci-checkin-details", JSON.stringify({ name: "Judy Daliva", position: "Director", affiliation: "home" }));
    render(<CheckinForm code="abc123def456" event={event} />);
    expect(await screen.findByText("Welcome back, Judy")).toBeTruthy();
    expect(screen.queryByLabelText("Full name")).toBeNull();
    fireEvent.click(screen.getByLabelText(/I agree/));
    fireEvent.click(screen.getByRole("button", { name: "Check in" }));
    fireEvent.click(await screen.findByRole("button", { name: "Check in someone else" }));
    expect(screen.queryByText("Welcome back, Judy")).toBeNull();
    expect(screen.getByLabelText("Full name").value).toBe("");
  });
});

const rows = [
  { id: 1, name: "Judy Daliva", position: "Director", affiliation: "home", localOrganization: "JCI Roxas Halaran", email: null, source: "qr", checkedInAt: "2027-01-15T10:05:00Z" },
  { id: 2, name: "Ana Reyes", position: "Local President", affiliation: "other_lo", localOrganization: "JCI Capiz", email: null, source: "admin", checkedInAt: "2027-01-15T10:10:00Z" },
];

describe("CheckinForm for our members only", () => {
  it("skips the Local Organization question", () => {
    render(<CheckinForm code="abc123def456" event={event} membersOnly />);
    expect(screen.queryByLabelText(/Another JCI chapter/)).toBeNull();
    expect(screen.getByText("JCI Roxas Halaran members check-in")).toBeTruthy();
  });
});

describe("AttendancePanel", () => {
  it("counts, filters and searches the people on the sheet", () => {
    render(<AttendancePanel event={{ id: 7, title: "GA", startAt: "2027-01-15T18:00" }} rows={rows} checkin={{ open: false }} />);
    expect(screen.getByRole("button", { name: "Other chapters 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Other chapters 1" }));
    expect(screen.queryByText("Judy Daliva")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "All 2" }));
    fireEvent.change(screen.getByLabelText("Search participants"), { target: { value: "capiz" } });
    expect(screen.getByText("Ana Reyes")).toBeTruthy();
    expect(screen.queryByText("Judy Daliva")).toBeNull();
  });

  it("opens check-in, and removes someone only on the second click", async () => {
    render(<AttendancePanel event={{ id: 7, title: "GA", startAt: "2027-01-15T18:00" }} rows={rows} checkin={{ open: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Open check-in" }));
    await waitFor(() => expect(actions.setCheckinAction).toHaveBeenCalledWith(7, { open: true, newCode: false }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Ana Reyes" }));
    expect(actions.removeAttendeeAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }));
    await waitFor(() => expect(screen.queryByText("Ana Reyes")).toBeNull());
    expect(actions.removeAttendeeAction).toHaveBeenCalledWith(2);
  });

  it("shows the QR and its tools while check-in is open", () => {
    render(<AttendancePanel event={{ id: 7, title: "GA", startAt: "2027-01-15T18:00" }} rows={[]} checkin={{ open: true, url: "https://x/check-in/abc", qrSvg: "<svg></svg>" }} />);
    expect(screen.getByRole("img", { name: "Check-in QR code" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Show QR poster" }).getAttribute("href")).toBe("/admin/events/7/check-in-qr");
    expect(within(screen.getByRole("region", { name: "Attendance" })).getByText("No one has checked in yet.")).toBeTruthy();
  });
});

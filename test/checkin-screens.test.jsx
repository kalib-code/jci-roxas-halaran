// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const checkInAction = vi.fn();
const actions = { setCheckinAction: vi.fn(async () => ({ ok: true })), setCheckinNearbyAction: vi.fn(async () => ({ ok: true })), findVenueAction: vi.fn(), addAttendeeAction: vi.fn(), updateAttendeeAction: vi.fn(), removeAttendeeAction: vi.fn(async () => ({ ok: true })) };
vi.mock("@/app/actions/attendance.js", () => ({ checkInAction: (...a) => checkInAction(...a) }));
vi.mock("@/app/admin/events/actions.js", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// The real map needs a browser; this one puts the pin wherever it's sent.
vi.mock("@/components/admin/VenueMap.jsx", async () => {
  const { useEffect } = await import("react");
  return {
    default: function VenueMap({ goTo, onMove }) {
      useEffect(() => onMove(goTo ? { lat: goTo.lat, lng: goTo.lng } : { lat: 11.5853, lng: 122.7511 }), [goTo]);
      return <p>Map</p>;
    },
  };
});
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
afterEach(() => { cleanup(); vi.clearAllMocks(); delete navigator.geolocation; });

// A phone whose location answers with these coordinates (or an error code).
const phoneAt = (where) => {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition: (ok, fail) => (typeof where === "number" ? fail({ code: where }) : ok({ coords: { latitude: where.lat, longitude: where.lng, accuracy: where.accuracy } })) },
  });
};
const PARK = { lat: 11.6047, lng: 122.7339 };

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

describe("CheckinForm venue check", () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ana Reyes" } });
    fireEvent.click(screen.getByLabelText(/^JCI Roxas Halaran/));
    fireEvent.change(screen.getByLabelText("Position or designation"), { target: { value: "Member" } });
    fireEvent.click(screen.getByLabelText(/I agree that JCI Roxas Halaran may record/));
  };

  it("keeps Check in off until the phone is near the venue, then sends the reading", async () => {
    checkInAction.mockResolvedValue({ ok: true, name: "Ana Reyes", at: "5:10 PM" });
    render(<CheckinForm code="abc123def456" event={{ ...event, venue: "People's Park" }} nearby={PARK} />);
    fill();
    const submit = screen.getByRole("button", { name: "Check in" });
    expect(submit.disabled).toBe(true);
    phoneAt({ lat: 11.5853, lng: 122.7511, accuracy: 20 });
    fireEvent.click(screen.getByRole("button", { name: "Share my location" }));
    expect(await screen.findByText(/You're about 2\.9 km from People's Park/)).toBeTruthy();
    expect(submit.disabled).toBe(true);
    phoneAt({ lat: 11.605, lng: 122.7345, accuracy: 25 });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("You're at the venue")).toBeTruthy();
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(checkInAction).toHaveBeenCalled());
    expect(checkInAction.mock.calls[0][0].location).toEqual({ lat: 11.605, lng: 122.7345, accuracy: 25 });
  });

  it("explains a blocked location and points to the registration table", async () => {
    render(<CheckinForm code="abc123def456" event={event} nearby={PARK} />);
    phoneAt(1);
    fireEvent.click(screen.getByRole("button", { name: "Share my location" }));
    expect(await screen.findByText(/Location is blocked for this page/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check in" }).disabled).toBe(true);
  });

  it("doesn't ask for a location when the event has no venue check", () => {
    render(<CheckinForm code="abc123def456" event={event} />);
    expect(screen.queryByRole("button", { name: "Share my location" })).toBeNull();
  });
});

describe("VenueCheck settings", () => {
  const base = { id: 7, title: "GA", startAt: "2027-01-15T18:00", venue: "Villareal Stadium" };
  const STADIUM = { name: "Villareal Stadium", area: "Roxas City, Capiz", lat: 11.5754, lng: 122.7584 };

  it("finds the venue by its name, then pins it and turns the check on", async () => {
    actions.findVenueAction.mockResolvedValue({ ok: true, places: [STADIUM, { name: "Villareal Stadium", area: "Iloilo City, Iloilo", lat: 10.72, lng: 122.56 }] });
    render(<AttendancePanel event={base} rows={[]} checkin={{ open: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Turn on venue check" }));
    expect(actions.findVenueAction).toHaveBeenCalledWith("Villareal Stadium");
    await waitFor(() => expect(screen.getByRole("button", { name: /Roxas City, Capiz/ }).getAttribute("aria-pressed")).toBe("true"));
    expect(screen.getByText("Pin at 11.57540, 122.75840. The shaded circle is the 1 km check-in area.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pin and turn on" }));
    await waitFor(() => expect(actions.setCheckinNearbyAction).toHaveBeenCalledWith(7, { nearby: true, place: { lat: 11.5754, lng: 122.7584 } }));
  });

  it("says when nothing on the map matches", async () => {
    actions.findVenueAction.mockResolvedValue({ ok: true, places: [] });
    render(<AttendancePanel event={base} rows={[]} checkin={{ open: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Turn on venue check" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/^Nothing on the map matches "Villareal Stadium"/));
    fireEvent.change(screen.getByLabelText("Find the venue"), { target: { value: "Nowhere Hall" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/^Nothing on the map matches "Nowhere Hall"/));
  });

  it("shows the pin on OpenStreetMap and turns off without asking again", async () => {
    render(<AttendancePanel event={{ ...base, ...PARK, checkinNearby: true }} rows={[]} checkin={{ open: false }} />);
    expect(screen.getByText("Venue check on")).toBeTruthy();
    expect(screen.getByRole("link", { name: "11.60470, 122.73390" }).getAttribute("href")).toBe("https://www.openstreetmap.org/?mlat=11.6047&mlon=122.7339#map=17/11.6047/122.7339");
    fireEvent.click(screen.getByRole("button", { name: "Turn off" }));
    await waitFor(() => expect(actions.setCheckinNearbyAction).toHaveBeenCalledWith(7, { nearby: false }));
  });

  it("moves the pin to where the organizer stands, if the phone is precise enough", async () => {
    render(<AttendancePanel event={{ ...base, ...PARK, checkinNearby: true }} rows={[]} checkin={{ open: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Move pin" }));
    expect(actions.findVenueAction).not.toHaveBeenCalled();
    phoneAt({ lat: 11.6069, lng: 122.7376, accuracy: 900 });
    fireEvent.click(screen.getByRole("button", { name: "Use where I am now" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/too rough to pin the venue \(within 900 m\)/));
    phoneAt({ lat: 11.6069, lng: 122.7376, accuracy: 15 });
    fireEvent.click(screen.getByRole("button", { name: "Use where I am now" }));
    await waitFor(() => expect(screen.getByText(/^Pin at 11\.60690, 122\.73760\./)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Save pin" }));
    await waitFor(() => expect(actions.setCheckinNearbyAction).toHaveBeenCalledWith(7, { nearby: true, place: { lat: 11.6069, lng: 122.7376 } }));
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

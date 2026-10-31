// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { sheetPages, needsOrganizationColumn, eventWhen, timeIn } from "@/lib/engagement/attendance-sheet.js";
import AttendanceSheet from "@/components/admin/AttendanceSheet.jsx";

afterEach(cleanup);

const rows = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `P${i + 1}`, position: "Member", affiliation: "home", localOrganization: "JCI Roxas Halaran", source: "qr", checkedInAt: "2027-01-15T10:05:09Z", ...extra }));
const event = { title: "General Assembly", startAt: "2027-01-15T18:00", endAt: "2027-01-15T21:00", venue: "Roxas City Hall" };
const certifiers = { president: "Jaime Cortes M. Altavas", secretary: "John Moses Aposaga", chairperson: null };

describe("sheetPages", () => {
  it("fills 18 rows a page in portrait and 10 in landscape", () => {
    expect(sheetPages(rows(40)).map((p) => p.length)).toEqual([18, 18, 4]);
    expect(sheetPages(rows(25), { layout: "landscape" }).map((p) => p.length)).toEqual([10, 10, 5]);
  });

  it("keeps room on the last page for the signatures", () => {
    expect(sheetPages(rows(10), { certify: true }).map((p) => p.length)).toEqual([10]);
    expect(sheetPages(rows(15), { certify: true }).map((p) => p.length)).toEqual([15, 0]);
    expect(sheetPages([], { certify: true })).toEqual([[]]);
  });

  it("prints one page of empty rows for a paper sheet", () => {
    expect(sheetPages([], { blankRows: 18 })).toEqual([Array(18).fill(null)]);
  });
});

describe("sheet wording", () => {
  it("adds the Local Organization column only when someone came from elsewhere", () => {
    expect(needsOrganizationColumn(rows(3))).toBe(false);
    expect(needsOrganizationColumn([...rows(2), ...rows(1, { affiliation: "other_lo" })])).toBe(true);
  });

  it("writes the date and time line in Philippine time", () => {
    expect(eventWhen(event)).toBe("January 15, 2027 · 6:00 PM – 9:00 PM");
    expect(eventWhen({ startAt: "2027-01-15T08:00" })).toBe("January 15, 2027 · 8:00 AM");
    expect(eventWhen({ startAt: "2027-01-15T08:00", endAt: "2027-01-16T17:00" })).toBe("January 15, 2027, 8:00 AM – January 16, 2027, 5:00 PM");
    expect(timeIn("2027-01-15T10:05:09Z", "2027-01-15")).toBe("6:05:09 PM");
    expect(timeIn("2027-01-16T01:00:00Z", "2027-01-15")).toBe("Jan 16, 9:00 AM");
  });
});

describe("AttendanceSheet", () => {
  it("follows the template and ends with the certification", () => {
    render(<AttendanceSheet event={event} rows={[...rows(1), ...rows(1, { id: 9, name: "Ana", affiliation: "other_lo", localOrganization: "JCI Capiz", source: "admin" })]} certifiers={certifiers} />);
    const page = screen.getByRole("region", { name: "Attendance sheet page 1 of 1" });
    expect(page.querySelector(".sheet-head").textContent).toBe("JCI Roxas HalaranGeneral AssemblyJanuary 15, 2027 · 6:00 PM – 9:00 PMRoxas City Hall");
    expect(within(page).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["NAME", "LOCAL ORGANIZATION", "POSITION", "TIME IN"]);
    expect(within(page).getByRole("row", { name: /Ana JCI Capiz Member 6:05:09 PM †/ })).toBeTruthy();
    expect(within(page).getByText("Jaime Cortes M. Altavas")).toBeTruthy();
    expect(within(page).getByText("Project Chairperson")).toBeTruthy();
    expect(within(page).getByText(/Total participants: 2/)).toBeTruthy();
  });

  it("lists only our members, without the chairperson line, when we don't chair the event", () => {
    const guest = { id: 9, name: "Ana", position: "Guest", affiliation: "guest", localOrganization: "Non-JCI guest", source: "qr", checkedInAt: "2027-01-15T10:05:09Z" };
    render(<AttendanceSheet event={{ ...event, weChair: false }} rows={[...rows(2), guest]} certifiers={{ president: "Jaime Cortes M. Altavas", secretary: "Joses M. Calusay" }} />);
    expect(screen.getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["NAME", "POSITION", "TIME IN"]);
    expect(screen.queryByText("Ana")).toBeNull();
    expect(screen.queryByText("Project Chairperson")).toBeNull();
    expect(screen.getByText("LO Secretary")).toBeTruthy();
    expect(screen.getByText(/Members of JCI Roxas Halaran who attended: 2/)).toBeTruthy();
  });

  it("prints a blank paper sheet with a signature column and no certification", () => {
    render(<AttendanceSheet event={event} rows={[]} certifiers={certifiers} blank />);
    expect(screen.getAllByRole("columnheader").at(-1).textContent).toBe("SIGNATURE");
    expect(screen.getAllByRole("row")).toHaveLength(19);
    expect(screen.queryByText("Certified true and correct:")).toBeNull();
  });
});

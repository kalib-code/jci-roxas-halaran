import { describe, it, expect } from "vitest";
import { eventDateParts, groupByMonth, mapsUrl } from "@/lib/eventDates.js";

describe("event dates", () => {
  it("splits a Philippine local time into display parts", () => {
    expect(eventDateParts("2026-11-07T15:00", "2026-11-07T18:30")).toMatchObject({
      day: "7", month: "NOV", monthLabel: "November 2026", date: "Saturday, November 7, 2026", time: "3:00 PM – 6:30 PM", endDate: null,
    });
    expect(eventDateParts("2026-11-07T08:00", "2026-11-08T17:00")).toMatchObject({ time: "8:00 AM", endDate: "Sunday, November 8, 2026" });
    expect(eventDateParts(null)).toBeNull();
  });

  it("groups events by month in order", () => {
    const groups = groupByMonth([{ startAt: "2026-11-02T09:00" }, { startAt: "2026-11-20T09:00" }, { startAt: "2026-12-05T09:00" }]);
    expect(groups.map((g) => [g.label, g.events.length])).toEqual([["November 2026", 2], ["December 2026", 1]]);
  });

  it("builds a maps search only when there is a venue", () => {
    expect(mapsUrl("SM City Roxas")).toBe("https://www.google.com/maps/search/?api=1&query=SM%20City%20Roxas%2C%20Capiz%2C%20Philippines");
    expect(mapsUrl(null)).toBeNull();
  });
});

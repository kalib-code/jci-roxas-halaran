import { describe, it, expect } from "vitest";
import { initials, formatDate, slugify } from "@/lib/format.js";

describe("initials", () => {
  it("uses the first and last name", () => {
    expect(initials("Judy Daliva")).toBe("JD");
  });
  it("skips middle initials and suffixes", () => {
    expect(initials("Elmer D. Jimenez Jr.")).toBe("EJ");
    expect(initials("Mark Vincent D. Bernas")).toBe("MB");
  });
  it("handles a single name", () => {
    expect(initials("Lemuel")).toBe("L");
  });
});

describe("formatDate", () => {
  it("formats an ISO date in long form", () => {
    expect(formatDate("2025-07-08")).toBe("July 8, 2025");
  });
  it("returns null for missing or invalid dates", () => {
    expect(formatDate(null)).toBeNull();
    expect(formatDate("not-a-date")).toBeNull();
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Talentadong Tatay 2026")).toBe("talentadong-tatay-2026");
  });
  it("drops quotes, apostrophes and punctuation", () => {
    expect(slugify("“Be a Friend, Not a Bully”")).toBe("be-a-friend-not-a-bully");
    expect(slugify("Symposium on Men's Mental Health")).toBe("symposium-on-mens-mental-health");
  });
  it("removes accents", () => {
    expect(slugify("Pan-ay Café")).toBe("pan-ay-cafe");
  });
});

import { phNow, formatDateTime, ageOn, formatPesos } from "@/lib/format.js";

describe("event and money formatting", () => {
  it("gives Philippine local time", () => {
    expect(phNow(new Date("2026-11-01T00:00:00Z"))).toBe("2026-11-01T08:00");
  });
  it("formats a stored event time", () => {
    expect(formatDateTime("2026-11-30T09:00")).toBe("Nov 30, 2026, 9:00 AM");
    expect(formatDateTime(null)).toBeNull();
  });
  it("computes age on a date", () => {
    expect(ageOn("2000-11-30", "2026-11-29")).toBe(25);
    expect(ageOn("2000-11-30", "2026-11-30T10:00:00.000Z")).toBe(26);
  });
  it("formats pesos", () => {
    expect(formatPesos(150000)).toBe("₱1,500");
  });
});

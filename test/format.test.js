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

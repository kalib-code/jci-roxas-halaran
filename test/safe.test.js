import { describe, it, expect } from "vitest";
import { csvCell, safeHttpsUrl } from "@/lib/safe.js";

describe("csvCell", () => {
  it("quotes and escapes values", () => {
    expect(csvCell('Ana "AC" Cruz')).toBe('"Ana ""AC"" Cruz"');
    expect(csvCell(null)).toBe('""');
  });
  it("neutralises spreadsheet formulas", () => {
    for (const v of ["=HYPERLINK(\"http://x\")", "+1", "-2", "@SUM(A1)", "\t=1", "\r=1"]) {
      expect(csvCell(v).startsWith(`"'`)).toBe(true);
    }
  });
});

describe("safeHttpsUrl", () => {
  it("allows https links only", () => {
    expect(safeHttpsUrl("https://abc.public.blob.vercel-storage.com/p.jpg")).toBe("https://abc.public.blob.vercel-storage.com/p.jpg");
    expect(safeHttpsUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpsUrl("JaVaScRiPt:alert(1)")).toBeNull();
    expect(safeHttpsUrl("http://x.ph/a.jpg")).toBeNull();
    expect(safeHttpsUrl(null)).toBeNull();
  });
});

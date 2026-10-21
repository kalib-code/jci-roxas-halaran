import { describe, it, expect } from "vitest";
import { popupHtml } from "@/lib/proof/popup.js";

describe("popupHtml", () => {
  it("escapes project text and links to the project page", () => {
    const html = popupHtml({ slug: "x", title: 'Clean-up <script>alert(1)</script> "Baybay"', startDate: "2026-06-20", barangay: "Baybay & Culasi" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;Baybay&quot;");
    expect(html).toContain("Baybay &amp; Culasi");
    expect(html).toContain('href="/projects/x"');
  });
});

import { describe, it, expect } from "vitest";
import { checkUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads.js";

describe("checkUpload", () => {
  it("accepts JPG, PNG, WebP and PDF up to 10 MB", () => {
    expect(checkUpload({ type: "image/jpeg", size: 2_000_000 })).toBeNull();
    expect(checkUpload({ type: "application/pdf", size: MAX_UPLOAD_BYTES })).toBeNull();
  });

  it("refuses iPhone HEIC photos with a fix-it message", () => {
    expect(checkUpload({ type: "image/heic", size: 2_000_000 })).toBe(
      "This file type isn't supported. Use a JPG, PNG or WebP image, or a PDF. (iPhone photos: share as JPG first.)",
    );
  });

  it("refuses files over 10 MB", () => {
    expect(checkUpload({ type: "image/jpeg", size: 12 * 1024 * 1024 })).toBe(
      "This file is 12.0 MB. The limit is 10 MB — resize or compress it first.",
    );
  });
});

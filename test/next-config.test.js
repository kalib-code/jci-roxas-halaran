import { describe, it, expect } from "vitest";
import config from "../next.config.mjs";

// Next's matcher for remotePatterns hostnames: "*" matches one subdomain label.
const allows = (hostname) =>
  (config.images?.remotePatterns ?? []).some((p) => {
    const re = new RegExp(`^${p.hostname.replace(/\./g, "\\.").replace(/^\*\\\./, "[^.]+\\.")}$`);
    return p.protocol === "https" && re.test(hostname);
  });

describe("next.config images", () => {
  it("lets next/image load covers and gallery photos uploaded to Vercel Blob", () => {
    expect(allows("abc123xyz.public.blob.vercel-storage.com")).toBe(true);
  });

  it("does not open next/image to arbitrary hosts", () => {
    expect(allows("evil.example")).toBe(false);
  });
});

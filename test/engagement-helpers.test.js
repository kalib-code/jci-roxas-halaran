import { describe, it, expect, vi } from "vitest";
import { applicationInput, pledgeInput, volunteerInput, toCentavos } from "@/lib/engagement/validation.js";
import { verifyTurnstile } from "@/lib/turnstile.js";
import { sendEmail } from "@/lib/email.js";
import { buildIcs } from "@/lib/ics.js";

describe("engagement validation", () => {
  it("requires consent with a clear message", () => {
    const r = applicationInput.safeParse({ name: "Ana Cruz", email: "a@x.ph", birthdate: "2000-01-01", consent: false });
    expect(r.error.issues.map((i) => i.message)).toContain("Please agree to the privacy notice");
  });
  it("normalises email and reference numbers", () => {
    expect(applicationInput.parse({ name: "Ana Cruz", email: " Ana@X.PH ", birthdate: "2000-01-01", consent: true }).email).toBe("ana@x.ph");
    expect(pledgeInput.parse({ payerName: "Ana", payerEmail: "a@x.ph", amountPesos: "150.5", method: "gcash", referenceNo: " ab12cd ", consent: true }).referenceNo).toBe("AB12CD");
  });
  it("needs a project or an event to volunteer for", () => {
    expect(volunteerInput.safeParse({ name: "Ana Cruz", email: "a@x.ph", consent: true }).error.issues[0].message).toBe("Choose a project or event");
  });
  it("converts pesos to centavos", () => {
    expect(toCentavos(150.5)).toBe(15050);
  });
});

describe("verifyTurnstile", () => {
  it("passes when no secret is configured (local development)", async () => {
    expect(await verifyTurnstile("", { secret: "" })).toBe(true);
  });
  it("fails without a token when a secret is configured", async () => {
    expect(await verifyTurnstile("", { secret: "s" })).toBe(false);
  });
  it("asks Cloudflare and trusts its answer", async () => {
    const fetchImpl = vi.fn(async () => ({ json: async () => ({ success: true }) }));
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl })).toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });
  it("fails closed when Cloudflare is unreachable", async () => {
    expect(await verifyTurnstile("tok", { secret: "s", fetchImpl: async () => { throw new Error("down"); } })).toBe(false);
  });
  it("rejects a token solved on a host outside the allowlist", async () => {
    const fetchImpl = async () => ({ json: async () => ({ success: true, hostname: "evil.example" }) });
    expect(await verifyTurnstile("tok", { secret: "s", hostnames: "jciroxashalaran.com", fetchImpl })).toBe(false);
  });
  it("accepts an allowlisted host, ignoring case and spaces in the list", async () => {
    const fetchImpl = async () => ({ json: async () => ({ success: true, hostname: "www.jciroxashalaran.com" }) });
    const hostnames = "jci-roxas-halaran.vercel.app, WWW.jciroxashalaran.com";
    expect(await verifyTurnstile("tok", { secret: "s", hostnames, fetchImpl })).toBe(true);
  });
  it("skips the host check when no allowlist is set", async () => {
    const fetchImpl = async () => ({ json: async () => ({ success: true, hostname: "anything.example" }) });
    expect(await verifyTurnstile("tok", { secret: "s", hostnames: "", fetchImpl })).toBe(true);
  });
  it("rejects an oversized token without calling Cloudflare", async () => {
    const fetchImpl = vi.fn(async () => ({ json: async () => ({ success: true }) }));
    expect(await verifyTurnstile("x".repeat(2049), { secret: "s", fetchImpl })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("sendEmail", () => {
  it("skips quietly when not configured", async () => {
    expect(await sendEmail({ to: "a@x.ph", subject: "s", text: "t" }, { apiKey: "" })).toEqual({ sent: false, reason: "not-configured" });
  });
  it("posts to Resend", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    expect(await sendEmail({ to: "a@x.ph", subject: "Hi", text: "t" }, { apiKey: "k", from: "JCI <hi@x.ph>", fetchImpl })).toEqual({ sent: true });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ from: "JCI <hi@x.ph>", to: "a@x.ph", subject: "Hi", text: "t" });
  });
  it("reports failures without throwing", async () => {
    expect(await sendEmail({ to: "a", subject: "s", text: "t" }, { apiKey: "k", fetchImpl: async () => ({ ok: false, status: 422 }) })).toEqual({ sent: false, reason: "http-422" });
    expect(await sendEmail({ to: "a", subject: "s", text: "t" }, { apiKey: "k", fetchImpl: async () => { throw new Error("down"); } })).toEqual({ sent: false, reason: "down" });
  });
});

describe("buildIcs", () => {
  it("writes a calendar entry in UTC with escaped text", () => {
    const ics = buildIcs(
      { id: 3, slug: "ga", title: "General Assembly, 2027", venue: "Capiz; Roxas City", startAt: "2027-01-15T18:00", endAt: null },
      { siteUrl: "https://jciroxashalaran.com", now: new Date("2026-11-01T00:00:00Z") },
    );
    expect(ics).toContain("DTSTART:20270115T100000Z\r\n");
    expect(ics).toContain("DTEND:20270115T120000Z\r\n");
    expect(ics).toContain("SUMMARY:General Assembly\\, 2027\r\n");
    expect(ics).toContain("LOCATION:Capiz\\; Roxas City\r\n");
    expect(ics).toContain("URL:https://jciroxashalaran.com/events/ga\r\n");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  });
});

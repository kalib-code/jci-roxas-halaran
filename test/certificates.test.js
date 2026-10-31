import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { attendance } from "@/db/schema.js";
import { saveEvent } from "@/lib/engagement/events.js";
import { addAttendee, removeAttendee } from "@/lib/engagement/attendance.js";
import { dueCertificates, issueCertificate, sendDueCertificates, certificateView, eventEndsAt } from "@/lib/engagement/certificates.js";
import { sendEmail } from "@/lib/email.js";

// The event runs 5–8 PM in Roxas (09:00–12:00 UTC) on Jan 15, 2027.
const at = (iso) => new Date(iso);
let db;
let event;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  event = (await saveEvent(db, { title: "General Assembly", startAt: "2027-01-15T17:00", endAt: "2027-01-15T20:00", venue: "Roxas City Hall", chairperson: "Raymark B. Bigcas" })).event;
  await addAttendee(db, event.id, { name: "Ana Reyes", position: "Local President", affiliation: "other_lo", localOrganization: "JCI Capiz", email: "ana@x.ph" }, { userId: "u" });
  await addAttendee(db, event.id, { name: "Ben Cruz", position: "Guest", affiliation: "guest" }, { userId: "u" });
});

const render = vi.fn(async () => new Uint8Array([137, 80, 78, 71]));
const sent = () => ({ sent: true });

describe("when certificates are due", () => {
  it("an hour after the event ends, only for people who gave an email", async () => {
    expect(eventEndsAt(event)).toBe(at("2027-01-15T12:00:00Z").getTime());
    expect(await dueCertificates(db, { now: at("2027-01-15T12:59:00Z") })).toHaveLength(0);
    const due = await dueCertificates(db, { now: at("2027-01-15T13:00:00Z") });
    expect(due.map((d) => d.attendee.name)).toEqual(["Ana Reyes"]);
  });

  it("never for events more than two weeks past, nor twice", async () => {
    expect(await dueCertificates(db, { now: at("2027-02-01T00:00:00Z") })).toHaveLength(0);
    await sendDueCertificates(db, { now: at("2027-01-15T13:00:00Z"), render, send: sent, pause: 0 });
    expect(await dueCertificates(db, { now: at("2027-01-15T14:00:00Z") })).toHaveLength(0);
  });

  it("an organizer's 'Send now' skips the wait, but not before the event starts", async () => {
    expect(await dueCertificates(db, { eventId: event.id, now: at("2027-01-15T08:00:00Z") })).toHaveLength(0);
    expect(await dueCertificates(db, { eventId: event.id, now: at("2027-01-15T09:30:00Z") })).toHaveLength(1);
  });
});

describe("issuing a certificate", () => {
  it("emails it as a PNG with a verify link, then marks it sent", async () => {
    const send = vi.fn(sent);
    const [due] = await dueCertificates(db, { now: at("2027-01-15T13:00:00Z") });
    const r = await issueCertificate(db, due, { render, send, now: at("2027-01-15T13:00:00Z") });
    expect(r.ok).toBe(true);
    const msg = send.mock.calls[0][0];
    expect(msg).toMatchObject({ to: "ana@x.ph", subject: "Certificate of attendance: General Assembly" });
    expect(msg.text).toContain(`/certificate/${r.code}`);
    expect(msg.attachments).toEqual([{ filename: `certificate-${r.code}.png`, content: "iVBORw==" }]);
    const [row] = await db.select().from(attendance).where(eq(attendance.email, "ana@x.ph"));
    expect(row).toMatchObject({ certificateCode: r.code, certificateSentAt: "2027-01-15T13:00:00.000Z" });
  });

  it("leaves it unsent when the email fails, so the next run retries", async () => {
    const r = await sendDueCertificates(db, { now: at("2027-01-15T13:00:00Z"), render, send: () => ({ sent: false, reason: "http-422" }), pause: 0 });
    expect(r).toEqual({ sent: 0, failed: [{ name: "Ana Reyes", error: "http-422" }] });
    expect(await dueCertificates(db, { now: at("2027-01-15T14:00:00Z") })).toHaveLength(1);
  });
});

describe("verifying a certificate", () => {
  it("shows what was certified and who signed, and stops working if the person is removed", async () => {
    const [due] = await dueCertificates(db, { now: at("2027-01-15T13:00:00Z") });
    const { code } = await issueCertificate(db, due, { render, send: sent, now: at("2027-01-15T13:00:00Z") });
    const view = await certificateView(db, code);
    expect(view).toMatchObject({ name: "Ana Reyes", localOrganization: "JCI Capiz", eventTitle: "General Assembly", venue: "Roxas City Hall" });
    expect(view.signers.map(([, title]) => title)).toEqual(["LO President", "LO Secretary", "Project Chairperson"]);
    expect(await certificateView(db, "made-up-code")).toBeNull();
    await removeAttendee(db, due.attendee.id);
    expect(await certificateView(db, code)).toBeNull();
  });
});

describe("sendEmail attachments", () => {
  it("passes attachments to Resend only when there are some", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }));
    await sendEmail({ to: "a@x.ph", subject: "s", text: "t", attachments: [{ filename: "c.png", content: "AA==" }] }, { apiKey: "k", fetchImpl });
    await sendEmail({ to: "a@x.ph", subject: "s", text: "t" }, { apiKey: "k", fetchImpl });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).attachments).toEqual([{ filename: "c.png", content: "AA==" }]);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).not.toHaveProperty("attachments");
  });
});

describe("the hourly job", () => {
  const OLD = process.env.CRON_SECRET;
  afterEach(() => { process.env.CRON_SECRET = OLD; });
  it("refuses without the secret, and when the secret isn't set at all", async () => {
    vi.doMock("@/lib/engagement/certificate-image.jsx", () => ({ renderCertificate: async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }) }));
    const { GET } = await import("@/app/api/cron/certificates/route.js");
    delete process.env.CRON_SECRET;
    expect((await GET(new Request("https://x/api/cron/certificates"))).status).toBe(503);
    process.env.CRON_SECRET = "s3cret-value";
    expect((await GET(new Request("https://x/api/cron/certificates", { headers: { authorization: "Bearer nope" } }))).status).toBe(401);
  });
});

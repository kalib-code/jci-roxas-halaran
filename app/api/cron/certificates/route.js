import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db.js";
import { sendEmail } from "@/lib/email.js";
import { sendDueCertificates } from "@/lib/engagement/certificates.js";
import { renderCertificate } from "@/lib/engagement/certificate-image.jsx";

export const maxDuration = 60;

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Vercel Cron, hourly (vercel.json): emails certificates for events that ended
// at least an hour ago. Vercel sends CRON_SECRET as a bearer token; without
// the secret set, the route refuses rather than running unprotected.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!same(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  const result = await sendDueCertificates(getDb(), {
    render: async (view) => (await renderCertificate(view)).arrayBuffer(),
    send: sendEmail,
  });
  if (result.failed.length) console.error("Certificates not sent", result.failed);
  return Response.json(result);
}

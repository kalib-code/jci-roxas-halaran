import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getDrive } from "@/lib/engagement/volunteers.js";
import { qrPng, volunteerUrl } from "@/lib/members/qr.js";

export async function GET(request, { params }) {
  await requireArea("content");
  const { id } = await params;
  const drive = await getDrive(getDb(), id);
  if (!drive) return new Response("Not found", { status: 404 });
  const png = await qrPng(volunteerUrl(new URL(request.url).origin, drive.slug));
  if (!png) return new Response("QR code failed", { status: 500 });
  return new Response(png, {
    headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="volunteer-${drive.slug}-qr.png"` },
  });
}

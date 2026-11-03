import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { getDrive } from "@/lib/engagement/volunteers.js";
import { qrSvgFile, volunteerUrl } from "@/lib/members/qr.js";

export async function GET(request, { params }) {
  await requireArea("content");
  const { id } = await params;
  const drive = await getDrive(getDb(), id);
  if (!drive) return new Response("Not found", { status: 404 });
  const svg = await qrSvgFile(volunteerUrl(new URL(request.url).origin, drive.slug));
  if (!svg) return new Response("QR code failed", { status: 500 });
  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="volunteer-${drive.slug}-qr.svg"` },
  });
}

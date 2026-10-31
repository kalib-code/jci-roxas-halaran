import { getDb } from "@/lib/db.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { qrPng, cardUrl } from "@/lib/members/qr.js";

export async function GET(request, { params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) return new Response("Not found", { status: 404 });
  const png = await qrPng(cardUrl(new URL(request.url).origin, card.slug));
  if (!png) return new Response("QR code failed", { status: 500 });
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${card.slug}-qr.png"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}

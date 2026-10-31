import { getDb } from "@/lib/db.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { qrSvgFile, cardUrl } from "@/lib/members/qr.js";

export async function GET(request, { params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) return new Response("Not found", { status: 404 });
  const svg = await qrSvgFile(cardUrl(new URL(request.url).origin, card.slug));
  if (!svg) return new Response("QR code failed", { status: 500 });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="${card.slug}-qr.svg"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}

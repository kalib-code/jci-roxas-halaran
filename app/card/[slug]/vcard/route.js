import { getDb } from "@/lib/db.js";
import { getPublicCard } from "@/lib/members/ecard.js";
import { vcard } from "@/lib/members/card-view.js";
import { cardUrl } from "@/lib/members/qr.js";

export async function GET(request, { params }) {
  const { slug } = await params;
  const card = await getPublicCard(getDb(), slug);
  if (!card) return new Response("Not found", { status: 404 });
  return new Response(vcard(card, cardUrl(new URL(request.url).origin, card.slug)), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${card.slug}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}

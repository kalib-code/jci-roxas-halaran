import { getDb } from "@/lib/db.js";
import { certificateView } from "@/lib/engagement/certificates.js";
import { renderCertificate } from "@/lib/engagement/certificate-image.jsx";

export async function GET(_request, { params }) {
  const { code } = await params;
  const view = await certificateView(getDb(), code);
  if (!view) return new Response("Not found", { status: 404 });
  const png = await (await renderCertificate(view)).arrayBuffer();
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="certificate-${view.code}.png"`,
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  });
}

import { getDb } from "@/lib/db.js";
import { getEventBySlug } from "@/lib/engagement/events.js";
import { buildIcs } from "@/lib/ics.js";
import { SITE } from "@/lib/site.js";

export async function GET(_request, { params }) {
  const { slug } = await params;
  const event = await getEventBySlug(getDb(), slug);
  if (!event) return new Response("Not found", { status: 404 });
  return new Response(buildIcs(event, { siteUrl: SITE.url }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
    },
  });
}

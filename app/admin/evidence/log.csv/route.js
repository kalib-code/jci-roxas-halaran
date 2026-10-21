import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { logCsv } from "@/lib/proof/evidence.js";

export async function GET() {
  await requireArea("content");
  return new Response(await logCsv(getDb()), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="jci-roxas-halaran-evidence-log.csv"' },
  });
}

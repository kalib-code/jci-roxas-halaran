import { requireArea } from "@/lib/auth.js";
import { getDb } from "@/lib/db.js";
import { monthlyEvidence, listSnapshots, evidenceCsv } from "@/lib/proof/evidence.js";

export async function GET() {
  await requireArea("content");
  const db = getDb();
  const [matrix, snapshots] = await Promise.all([monthlyEvidence(db), listSnapshots(db)]);
  return new Response(evidenceCsv(matrix, snapshots), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="jci-roxas-halaran-evidence.csv"' },
  });
}

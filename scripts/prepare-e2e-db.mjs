import { rmSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../lib/db.js";
import { seed } from "../db/seed.js";
import { saveArticle, publishArticle } from "../lib/content/articles.js";
import { saveEvent } from "../lib/engagement/events.js";
import { saveCampaign, submitPledge, confirmPayment, recordExpense } from "../lib/engagement/money.js";

rmSync("e2e.db", { force: true });
const db = createDb("file:e2e.db");
await migrate(db, { migrationsFolder: "db/migrations" });
await seed(db);
const ctx = { userId: "e2e" };
const draft = await saveArticle(db, { title: "Unfinished Draft", targetKeyword: "x" }, ctx);
const ready = await saveArticle(
  db,
  {
    title: "Bonifacio Day: History and Meaning",
    metaDescription: "Why the Philippines remembers Andrés Bonifacio every November 30.",
    targetKeyword: "bonifacio day",
    category: "holidays",
    bodyHtml: "<h2>Who was Bonifacio?</h2><p>Andrés Bonifacio founded the Katipunan in 1892.</p>",
  },
  ctx,
);
await publishArticle(db, ready.article.id, { expectedUpdatedAt: ready.article.updatedAt }, ctx);
console.log(`e2e articles: published ${ready.article.slug}, draft ${draft.article.slug}`);
await saveEvent(db, { title: "General Assembly 2027", startAt: "2099-01-15T18:00", venue: "Capiz Provincial Gym", capacity: 1 });
const { campaign } = await saveCampaign(db, {
  title: "Coastal Cleanup Fund",
  goalPesos: 20000,
  qrImageUrl: "/assets/img/logo-site.png",
  qrImageAlt: "GCash QR code for the Coastal Cleanup Fund",
  paymentInstructions: "GCash 0917 000 0000 — JCI Roxas Halaran",
});
// One confirmed general donation (kept off the campaign so its progress stays 0) and one campaign expense so /transparency has real figures (and a donor name it must hide).
const pledge = await submitPledge(db, {
  payerName: "Ana Villanueva",
  payerEmail: "ana.donor@example.ph",
  amountPesos: 1500,
  method: "gcash",
  referenceNo: "E2E0000001",
  consent: true,
});
await confirmPayment(db, pledge.payment.id, ctx);
await recordExpense(db, { amountPesos: 400, description: "Trash bags and gloves", spentOn: new Date().toISOString().slice(0, 10), campaignId: campaign.id }, ctx);
console.log("e2e.db ready.");

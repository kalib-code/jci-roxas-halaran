import { rmSync } from "node:fs";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createDb } from "../lib/db.js";
import { seed } from "../db/seed.js";
import { saveArticle, publishArticle } from "../lib/content/articles.js";

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
console.log("e2e.db ready.");

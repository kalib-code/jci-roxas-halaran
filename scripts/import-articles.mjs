import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createDb } from "../lib/db.js";
import { parseArticleFile, importArticles } from "../db/import-articles.js";

// Optional: `-- --except slug-a,slug-b` leaves those files out of this run.
const flag = process.argv.indexOf("--except");
const except = new Set(flag > -1 ? process.argv[flag + 1].split(",") : []);

const dir = "content/articles";
const files = (await readdir(dir)).filter((f) => f.endsWith(".html") && !except.has(f.slice(0, -5))).sort();
const parsed = await Promise.all(
  files.map(async (f) => {
    try {
      return parseArticleFile(await readFile(join(dir, f), "utf8"));
    } catch (e) {
      throw new Error(`${f}: ${e.message}`);
    }
  }),
);

const { added, refreshed, skipped } = await importArticles(createDb(), parsed);
console.log(`Added ${added.length} drafts, refreshed ${refreshed.length} untouched drafts, skipped ${skipped.length} edited or published.`);
for (const slug of skipped) console.log(`  skipped ${slug}`);

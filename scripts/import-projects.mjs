import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createDb } from "../lib/db.js";
import { parseProjectFile, importProjects } from "../db/import-projects.js";

const dir = "content/projects";
const files = (await readdir(dir)).filter((f) => f.endsWith(".html")).sort();
const parsed = await Promise.all(
  files.map(async (f) => {
    try {
      return parseProjectFile(await readFile(join(dir, f), "utf8"));
    } catch (e) {
      throw new Error(`${f}: ${e.message}`);
    }
  }),
);

const { added, filled, unchanged } = await importProjects(createDb(), parsed);
console.log(`Added ${added.length} projects, filled gaps in ${filled.length}, ${unchanged.length} unchanged.`);
for (const line of filled) console.log(`  filled ${line}`);

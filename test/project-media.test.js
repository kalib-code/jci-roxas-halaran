import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { projects } from "@/db/schema.js";
import { addProjectMedia, deleteProjectMedia, getProjectBySlug } from "@/lib/content/projects.js";
import { parseProjectFile, importProjects } from "@/db/import-projects.js";

let db, projectId;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
  [{ id: projectId }] = await db.select({ id: projects.id }).from(projects).where(eq(projects.slug, "coastline-cuts"));
});

const reel = "https://www.facebook.com/reel/1385490273655940/";

describe("project media", () => {
  it("adds a trusted link once, lists it on the project and removes it", async () => {
    const r = await addProjectMedia(db, { projectId, url: reel, title: "Coastline Cuts recap" });
    expect(r.ok).toBe(true);
    expect(await addProjectMedia(db, { projectId, url: reel, title: "Again" })).toEqual({ ok: false, errors: ["That link is already on this project"] });
    expect((await getProjectBySlug(db, "coastline-cuts")).media.map((m) => m.title)).toEqual(["Coastline Cuts recap"]);
    expect((await deleteProjectMedia(db, r.item.id)).ok).toBe(true);
    expect((await getProjectBySlug(db, "coastline-cuts")).media).toEqual([]);
  });

  it("refuses links from untrusted sites and media without a title", async () => {
    expect((await addProjectMedia(db, { projectId, url: "https://evil.com/video.mp4", title: "x" })).ok).toBe(false);
    expect((await addProjectMedia(db, { projectId, url: reel, title: " " })).errors).toEqual(["Add a title for the video or audio"]);
  });

  it("imports media lines from project files without duplicating them", async () => {
    const file = `---\ntitle: Coastline Cuts\nslug: coastline-cuts\nsummary: Free haircuts.\nmedia: ${reel} | Recap reel\nmedia: https://soundcloud.com/jci-roxas-halaran | HALAD on SoundCloud\n---\n<p>x</p>\n`;
    expect(() => parseProjectFile(file.replace(reel, "https://evil.com/x"))).toThrow("not a supported player");
    await importProjects(db, [parseProjectFile(file)]);
    await importProjects(db, [parseProjectFile(file)]);
    expect((await getProjectBySlug(db, "coastline-cuts")).media.map((m) => [m.title, m.sort])).toEqual([["Recap reel", 0], ["HALAD on SoundCloud", 1]]);
  });
});

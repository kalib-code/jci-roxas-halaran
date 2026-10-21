import { describe, it, expect, beforeEach } from "vitest";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { saveProject, getProjectBySlug, addProjectPhoto } from "@/lib/content/projects.js";
import { createResource, listResources } from "@/lib/content/resources.js";

const ctx = { userId: "user_admin", now: "2026-11-01T00:00:00.000Z" };
let db;
beforeEach(async () => {
  db = await testDb();
  await seed(db);
});

describe("projects", () => {
  it("creates a project with a slug and cleaned story", async () => {
    const r = await saveProject(db, { title: "Coastal Cleanup 2026", bodyHtml: "<p>We cleaned Baybay.</p><iframe></iframe>" }, ctx);
    expect(r.project).toMatchObject({ slug: "coastal-cleanup-2026", body: "<p>We cleaned Baybay.</p>", updatedAt: ctx.now });
  });

  it("keeps the slug after creation", async () => {
    const r = await saveProject(db, { title: "Tree Planting" }, ctx);
    const e = await saveProject(db, { id: r.project.id, expectedUpdatedAt: r.project.updatedAt, title: "Tree Planting 2026", slug: "other" }, ctx);
    expect(e.project.slug).toBe("tree-planting");
  });

  it("edits a seeded project that has no updatedAt yet", async () => {
    const seeded = await getProjectBySlug(db, "coastline-cuts");
    const r = await saveProject(db, { id: seeded.id, expectedUpdatedAt: seeded.updatedAt, title: "Coastline Cuts", summary: "Mangrove care" }, ctx);
    expect(r.ok).toBe(true);
  });

  it("requires alt text for gallery photos and returns them with the project", async () => {
    const p = await getProjectBySlug(db, "coastline-cuts");
    expect(await addProjectPhoto(db, { projectId: p.id, url: "/a.jpg", alt: "" })).toEqual({ ok: false, errors: ["Add alt text for the photo"] });
    await addProjectPhoto(db, { projectId: p.id, url: "/a.jpg", alt: "Volunteers planting mangroves" });
    expect((await getProjectBySlug(db, "coastline-cuts")).photos).toHaveLength(1);
  });
});

describe("resources", () => {
  it("creates a public resource and lists only public ones for the public page", async () => {
    await createResource(db, { title: "Project proposal template", fileUrl: "https://x.public.blob.vercel-storage.com/p.pdf" }, ctx);
    await createResource(db, { title: "Bylaws", fileUrl: "https://x.public.blob.vercel-storage.com/b.pdf", visibility: "members", kind: "bylaws" }, ctx);
    expect((await listResources(db, { visibility: "public" })).map((r) => r.title)).toEqual(["Project proposal template"]);
  });

  it("refuses a resource without an uploaded file", async () => {
    expect(await createResource(db, { title: "x", fileUrl: "" }, ctx)).toEqual({ ok: false, errors: ["Upload a file first"] });
  });

describe("resource links", () => {
  it("only accept https files on Vercel Blob", async () => {
    expect((await createResource(db, { title: "x", fileUrl: "javascript:alert(1)" }, ctx)).ok).toBe(false);
    expect((await createResource(db, { title: "x", fileUrl: "https://evil.example/x.pdf" }, ctx)).ok).toBe(false);
    expect((await createResource(db, { title: "x", fileUrl: "https://abc.public.blob.vercel-storage.com/x.pdf" }, ctx)).ok).toBe(true);
  });
});
});

import { describe, it, expect } from "vitest";
import { articleInput, publishProblems, hasText, imageAltProblems } from "@/lib/content/validation.js";

const ready = {
  title: "Rizal Day",
  metaDescription: "What Filipinos commemorate on December 30.",
  targetKeyword: "rizal day",
  bodyHtml: "<p>José Rizal was executed on December 30, 1896.</p>",
  coverUrl: null,
  coverAlt: null,
};

describe("articleInput", () => {
  it("fills defaults for an empty draft", () => {
    const r = articleInput.parse({});
    expect(r).toMatchObject({ title: "", category: "community", authorId: null, projectId: null });
  });

  it("rejects a meta description over 160 characters", () => {
    const r = articleInput.safeParse({ metaDescription: "x".repeat(161) });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toBe("Meta description must be 160 characters or fewer");
  });

  it("turns empty author and project selections into null", () => {
    expect(articleInput.parse({ authorId: "", projectId: "3" })).toMatchObject({ authorId: null, projectId: 3 });
  });
});

describe("publishProblems", () => {
  it("passes a complete article", () => {
    expect(publishProblems(ready)).toEqual([]);
  });

  it("lists every missing field", () => {
    expect(publishProblems({ title: "", metaDescription: "", targetKeyword: "", bodyHtml: "<p> </p>" })).toEqual([
      "Add a title",
      "Add a meta description",
      "Add a target keyword",
      "Write the article body",
    ]);
  });

  it("requires alt text for the cover and for every image in the body", () => {
    expect(
      publishProblems({ ...ready, coverUrl: "https://x.public.blob.vercel-storage.com/c.jpg", coverAlt: "", bodyHtml: '<p>Hi</p><img src="/a.jpg" alt="">' }),
    ).toEqual(["Add alt text for the cover image", "Add alt text to 1 image in the body"]);
  });
});

describe("helpers", () => {
  it("hasText ignores tags and whitespace", () => {
    expect(hasText("<p>&nbsp; </p>")).toBe(false);
    expect(hasText("<p>Hi</p>")).toBe(true);
  });

  it("counts images without alt text", () => {
    expect(imageAltProblems('<img src="/a.jpg" alt="A"><img src="/b.jpg"><img src="/c.jpg" alt=" ">')).toBe(2);
  });
});

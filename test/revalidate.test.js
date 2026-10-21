import { describe, it, expect } from "vitest";
import { pathsForArticle, pathsForProject, RESOURCE_PATHS } from "@/lib/revalidate.js";

describe("revalidation paths", () => {
  it("covers every page an article appears on", () => {
    expect(pathsForArticle("rizal-day")).toEqual(["/articles", "/articles/rizal-day", "/", "/sitemap.xml"]);
  });
  it("covers every page a project appears on", () => {
    expect(pathsForProject("coastline-cuts")).toEqual(["/projects", "/projects/coastline-cuts", "/", "/sitemap.xml"]);
  });
  it("covers the resources page", () => {
    expect(RESOURCE_PATHS).toEqual(["/resources"]);
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const h = vi.hoisted(() => ({ calls: [], replace: vi.fn(), save: vi.fn(), publish: vi.fn(), saveProject: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: (u) => { h.calls.push("replace"); h.replace(u); }, refresh: () => {} }) }));
vi.mock("@/components/admin/RichTextEditor.jsx", () => ({ default: () => <div>editor</div> }));
vi.mock("@/app/admin/articles/actions.js", () => ({
  saveArticleAction: (...a) => { h.calls.push("save"); return h.save(...a); },
  publishArticleAction: (...a) => { h.calls.push("publish"); return h.publish(...a); },
  unpublishArticleAction: async () => ({ ok: false, errors: [] }),
}));
vi.mock("@/app/admin/projects/actions.js", () => ({
  saveProjectAction: (...a) => h.saveProject(...a),
  addProjectPhotoAction: async () => ({ ok: true }),
  deleteProjectPhotoAction: async () => ({ ok: true }),
}));

const { default: ArticleEditor } = await import("@/components/admin/ArticleEditor.jsx");
const { default: ProjectEditor } = await import("@/components/admin/ProjectEditor.jsx");

const draft = { id: 7, slug: "rizal-day", status: "draft", publishedAt: null, updatedAt: "t1" };
const props = { authors: [], projects: [], planKeywords: [] };

beforeEach(() => {
  h.calls = [];
  h.replace.mockReset();
  h.save.mockReset();
  h.publish.mockReset();
  h.saveProject.mockReset();
});
afterEach(cleanup);

describe("ArticleEditor", () => {
  it("publishes a new article fully before moving to its edit page", async () => {
    h.save.mockResolvedValue({ ok: true, article: draft });
    h.publish.mockResolvedValue({ ok: true, article: { ...draft, status: "published", publishedAt: "t2", updatedAt: "t2" } });
    render(<ArticleEditor article={null} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await waitFor(() => expect(h.replace).toHaveBeenCalledWith("/admin/articles/7"));
    expect(h.calls).toEqual(["save", "publish", "replace"]);
  });

  it("keeps the editor and shows the error when saving fails", async () => {
    h.save.mockRejectedValue(new Error("network down"));
    render(<ArticleEditor article={null} {...props} />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't save (network down)");
    expect(screen.getByLabelText("Title").value).toBe("My draft");
  });

  it("offers Update, not Save draft, on a live article", () => {
    render(<ArticleEditor article={{ ...draft, status: "published", publishedAt: "t0", title: "Rizal Day", category: "holidays" }} {...props} />);
    expect(screen.queryByRole("button", { name: "Save draft" })).toBeNull();
    expect(screen.getByRole("button", { name: "Update" })).toBeTruthy();
  });
});

describe("ProjectEditor", () => {
  it("keeps the editor and shows the error when saving fails", async () => {
    h.saveProject.mockRejectedValue(new Error("network down"));
    render(<ProjectEditor project={null} />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Tree planting" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't save (network down)");
    expect(screen.getByLabelText("Title").value).toBe("Tree planting");
  });
});

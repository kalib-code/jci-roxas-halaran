// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ArticleView from "@/components/ArticleView.jsx";
import { SafeHtml } from "@/components/SafeHtml.jsx";

vi.mock("next/image", () => ({
  // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
  default: ({ fill, sizes, priority, ...props }) => <img {...props} />,
}));

const hostile = '<p>Hi</p><script>steal()</script><img src="x" onerror="steal()"><a href="javascript:steal()">x</a>';

describe("rendering stored HTML", () => {
  it("ArticleView cleans the body even if the database holds unsafe HTML", () => {
    const html = renderToStaticMarkup(
      <ArticleView article={{ slug: "a", title: "A", category: "community", publishedAt: null, bodyHtml: hostile }} related={[]} project={null} />,
    );
    expect(html).toContain("<p>Hi</p>");
    expect(html).not.toMatch(/<script|onerror|javascript:/);
  });

  it("SafeHtml cleans anything it is given", () => {
    const html = renderToStaticMarkup(<SafeHtml html={hostile} className="article-body" />);
    expect(html).not.toMatch(/<script|onerror|javascript:/);
  });
});

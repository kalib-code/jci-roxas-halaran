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

describe("outlineBody", () => {
  it("gives each h2 a unique id and lists them for the table of contents", async () => {
    const { outlineBody } = await import("@/lib/articleBody.js");
    const { html, headings } = outlineBody('<h2>Capiz &amp; you</h2><p>x</p><h2>FAQ</h2><h2>FAQ</h2><h2 onclick="x()">Hi</h2>');
    expect(headings.map((h) => h.id)).toEqual(["capiz-you", "faq", "faq-2", "hi"]);
    expect(headings[0].text).toBe("Capiz & you");
    expect(html).toContain('<h2 id="faq-2">FAQ</h2>');
    expect(html).not.toContain("onclick");
  });

  it("ArticleView shows the table of contents only for long articles", () => {
    const base = { slug: "a", title: "A", category: "community", publishedAt: null };
    const short = renderToStaticMarkup(<ArticleView article={{ ...base, bodyHtml: "<h2>One</h2><h2>Two</h2>" }} related={[]} project={null} />);
    const long = renderToStaticMarkup(<ArticleView article={{ ...base, bodyHtml: "<h2>One</h2><h2>Two</h2><h2>Three</h2>" }} related={[]} project={null} />);
    expect(short).not.toContain('class="toc"');
    expect(long).toContain('href="#three"');
  });
});

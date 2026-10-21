import { describe, it, expect } from "vitest";
import { cleanHtml } from "@/lib/sanitize.js";

const SITE = "https://jciroxashalaran.com";
const clean = (html) => cleanHtml(html, { siteUrl: SITE });

describe("cleanHtml", () => {
  it("keeps the formatting the editor produces", () => {
    const html = '<h2>Title</h2><p><strong>Bold</strong> and <em>italic</em></p><ul><li>One</li></ul><blockquote><p>Quote</p></blockquote>';
    expect(clean(html)).toBe(html);
  });

  it("removes scripts, event handlers and inline styles pasted from Word", () => {
    const html = '<p style="color:red" onclick="steal()">Hi<script>alert(1)</script><span class="MsoNormal">there</span></p>';
    expect(clean(html)).toBe("<p>Hithere</p>");
  });

  it("turns h1 and h4 into nothing but keeps their text", () => {
    expect(clean("<h1>Big</h1><h4>Small</h4>")).toBe("BigSmall");
  });

  it("drops javascript: links but keeps the text", () => {
    expect(clean('<p><a href="javascript:alert(1)">click</a></p>')).toBe("<p><a>click</a></p>");
  });

  it("marks external links noopener and leaves site links alone", () => {
    expect(clean('<a href="https://example.com">x</a>')).toBe('<a href="https://example.com" rel="noopener noreferrer" target="_blank">x</a>');
    expect(clean('<a href="/projects">x</a>')).toBe('<a href="/projects">x</a>');
    expect(clean(`<a href="${SITE}/join">x</a>`)).toBe(`<a href="${SITE}/join">x</a>`);
  });

  it("keeps images from Vercel Blob or the site and drops others", () => {
    const blob = '<img src="https://abc123.public.blob.vercel-storage.com/a.jpg" alt="Trees" />';
    expect(clean(blob)).toBe('<img src="https://abc123.public.blob.vercel-storage.com/a.jpg" alt="Trees" />');
    expect(clean('<img src="/assets/img/logo-site.png" alt="Logo" />')).toBe('<img src="/assets/img/logo-site.png" alt="Logo" />');
    expect(clean('<img src="https://evil.example/x.jpg" alt="x" />')).toBe("");
    expect(clean('<img src="//evil.example/x.jpg" alt="x" />')).toBe("");
  });

  it("handles empty input", () => {
    expect(clean("")).toBe("");
    expect(clean(null)).toBe("");
  });
});

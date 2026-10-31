import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { PNG } from "pngjs";
import { testDb } from "./helpers/db.js";
import { seed } from "@/db/seed.js";
import { members } from "@/db/schema.js";
import { qrPng, qrSvgFile } from "@/lib/members/qr.js";

let db;
vi.mock("@/lib/db.js", async (importOriginal) => ({ ...(await importOriginal()), getDb: () => db }));
const { GET } = await import("@/app/card/[slug]/qr.png/route.js");
const { GET: GET_SVG } = await import("@/app/card/[slug]/qr.svg/route.js");

const pixel = (png, x, y) => [...png.data.subarray((png.width * y + x) * 4, (png.width * y + x) * 4 + 3)];

describe("qrPng", () => {
  it("draws a large black-on-white code with a white border", async () => {
    const png = PNG.sync.read(await qrPng("https://site.ph/card/ana"));
    expect([png.width, png.height]).toEqual([1200, 1200]);
    expect(pixel(png, 5, 5)).toEqual([255, 255, 255]);
    let dark = 0;
    for (let i = 0; i < png.data.length; i += 4) if (png.data[i] === 0) dark += 1;
    expect(dark).toBeGreaterThan(0);
  });
});

describe("qrSvgFile", () => {
  it("draws the same code as a sized vector", async () => {
    const svg = await qrSvgFile("https://site.ph/card/ana");
    expect(svg).toMatch(/^<svg [^>]*width="1200" height="1200"/);
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('stroke="#000000"');
  });
});

describe("GET /card/[slug]/qr.png and qr.svg", () => {
  beforeEach(async () => {
    db = await testDb();
    await seed(db);
  });
  const get = (slug, handler = GET, ext = "png") => handler(new Request(`https://site.ph/card/${slug}/qr.${ext}`), { params: Promise.resolve({ slug }) });

  it("downloads the QR code only for a published card", async () => {
    expect((await get("lemuel-capa")).status).toBe(404);
    await db.update(members).set({ cardPublished: true }).where(eq(members.slug, "lemuel-capa"));
    const res = await get("lemuel-capa");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="lemuel-capa-qr.png"');
    expect(PNG.sync.read(Buffer.from(await res.arrayBuffer())).width).toBe(1200);
  });

  it("downloads the vector only for a published card", async () => {
    expect((await get("lemuel-capa", GET_SVG, "svg")).status).toBe(404);
    await db.update(members).set({ cardPublished: true }).where(eq(members.slug, "lemuel-capa"));
    const res = await get("lemuel-capa", GET_SVG, "svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="lemuel-capa-qr.svg"');
    expect(await res.text()).toMatch(/^<svg /);
  });
});

import { describe, it, expect } from "vitest";
import { embedFor } from "@/lib/media.js";

describe("embedFor", () => {
  it("builds embeds for the trusted players", () => {
    expect(embedFor("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ provider: "youtube", kind: "video", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
    expect(embedFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10").src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedFor("https://www.facebook.com/reel/1385490273655940/")).toMatchObject({ provider: "facebook", vertical: true });
    expect(embedFor("https://www.facebook.com/jciroxashalaran/videos/123456789/").src).toContain(encodeURIComponent("https://www.facebook.com/watch/?v=123456789"));
    expect(embedFor("https://soundcloud.com/jci-roxas-halaran/sets/who-won-juan")).toMatchObject({ provider: "soundcloud", kind: "audio" });
    expect(embedFor("https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy")).toMatchObject({ src: "https://open.spotify.com/embed/album/4aawyAB9vmqN3uQ7FjRGTy" });
  });

  it("rejects everything else", () => {
    for (const bad of [
      "http://youtu.be/dQw4w9WgXcQ",
      "javascript:alert(1)",
      "https://evil.com/reel/123",
      "https://www.facebook.com.evil.com/reel/123",
      "https://www.youtube.com/watch?v=abc\"onload=",
      "https://soundcloud.com/a/b/c/d",
      "<iframe src=https://youtube.com/embed/x>",
      "",
      null,
    ]) expect(embedFor(bad), String(bad)).toBeNull();
  });
});

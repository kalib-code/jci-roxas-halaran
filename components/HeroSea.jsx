"use client";

import { useEffect, useRef } from "react";

// A sea surface drawn as specks of black sand, seen in perspective behind the hero.
// Points sit on a flat grid in "world" space; slow swells lift them, and a simple
// pinhole projection squeezes far rows toward the horizon.
const Z_NEAR = 1;
const Z_FAR = 5.5;
const HORIZON = 0.42; // horizon line, as a share of the canvas height
const FPS = 30;

// Swells: k = how tight across the grid, speed = radians per second, amp = lift.
// Periods of roughly 12–18 s read as ocean swell rather than ripples.
const SWELLS = [
  { kx: 0.22, kz: 1.3, speed: 0.45, amp: 0.15 },
  { kx: -0.4, kz: 0.8, speed: 0.36, amp: 0.08 },
  { kx: 0.7, kz: 2.6, speed: 0.55, amp: 0.03 },
];

// Fixed per-speck offset in -0.5..0.5, so the grid scatters like sand but never flickers.
function jitter(i, j) {
  const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return n - Math.floor(n) - 0.5;
}

function lift(x, z, t) {
  let h = 0;
  for (const s of SWELLS) h += s.amp * Math.sin(s.kx * x + s.kz * z - s.speed * t);
  return h;
}

export default function HeroSea() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, frame = 0, last = 0, visible = true;

    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t) => {
      ctx.clearRect(0, 0, w, h);
      const horizon = h * HORIZON;
      const focal = (h - horizon) * Z_NEAR / 0.55; // camera height 0.55 puts the nearest row at the bottom
      const near = w < 640 ? 16 : 20; // screen gap between dots on the nearest row
      const dx = near * Z_NEAR / focal;
      const rows = w < 640 ? 40 : 56;
      for (let r = 0; r < rows; r++) {
        const z = Z_FAR - (Z_FAR - Z_NEAR) * (r / (rows - 1));
        const scale = focal / z;
        const span = (w / 2 + near) / scale;
        const fade = Math.min(1, ((Z_FAR - z) / 2.2) ** 2); // fade in softly from the horizon
        const dot = Math.max(0.7, 2.4 * Z_NEAR / z);
        for (let c = -Math.ceil(span / dx); c * dx <= span; c++) {
          const x = (c + jitter(r, c) * 0.8) * dx;
          const zz = z + jitter(c, r) * 0.6 * (Z_FAR - Z_NEAR) / rows;
          const lifted = lift(x, zz, t);
          const sx = w / 2 + x * scale;
          const sy = horizon + (0.55 - lifted) * focal / zz;
          if (sy > h + 4) continue;
          // Crests catch the light: brighter, and warmer toward ochre.
          const crest = Math.max(0, lifted / 0.2);
          ctx.globalAlpha = fade * (0.12 + 0.6 * crest);
          ctx.fillStyle = crest > 0.6 ? "#e5a823" : "#ede8df";
          ctx.fillRect(sx - dot / 2, sy - dot / 2, dot, dot);
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 1000 / FPS) return;
      last = now;
      draw(now / 1000);
    };
    const start = () => { if (!frame && !still && visible && !document.hidden) frame = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; };

    size();
    draw(8);
    start();

    const ro = new ResizeObserver(() => { size(); draw(last / 1000 || 8); });
    ro.observe(canvas);
    // Only animate while the hero is on screen and the tab is open.
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="sea" aria-hidden="true" />;
}

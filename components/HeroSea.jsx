"use client";

import { useEffect, useRef } from "react";

// A sea surface drawn as specks of black sand, seen in perspective behind the hero.
// Points sit on a flat grid in "world" space; slow swells lift them, and a simple
// pinhole projection squeezes far rows toward the horizon.
const Z_NEAR = 1;
const Z_FAR = 5.5;
const HORIZON = 0.22; // horizon line, as a share of the canvas height
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

const rand = (min, max) => min + Math.random() * (max - min);

// A set wave rolls in from beyond the horizon at a random moment, with its own
// height (rise, as a share of the canvas), width, speed and curve across the sea.
// The tallest ones crest up to the header.
function newSurge(t) {
  return {
    born: t,
    life: rand(9, 15),
    rise: Math.random() < 0.35 ? rand(0.32, 0.48) : rand(0.08, 0.24),
    width: rand(0.45, 0.9),
    kx: rand(0.15, 0.45),
    phase: rand(0, Math.PI * 2),
  };
}

// How far a surge has risen at (x, z): 0..1, peaking on its moving crest line.
function surgeAt(s, x, z, t) {
  const age = (t - s.born) / s.life;
  const crestZ = Z_FAR + 0.6 - (Z_FAR - Z_NEAR + 1.2) * age;
  const across = 0.7 + 0.3 * Math.sin(s.kx * x + s.phase);
  return Math.sin(Math.PI * age) * Math.exp(-(((z - crestZ) / s.width) ** 2)) * across;
}

function lift(x, z, t) {
  let h = 0;
  for (const s of SWELLS) h += s.amp * Math.sin(s.kx * x + s.kz * z - s.speed * t);
  return h;
}

// A ripple left by dragging across the sea: rings spread out from (x, z) and fade.
const RIPPLE_SPEED = 0.9; // world units per second
const RIPPLE_LIFE = 3.2;
const MAX_RIPPLES = 28;
const HOVER_RADIUS = 190; // px around the pointer that the water swells toward

function rippleAt(p, x, z, t) {
  const age = t - p.born;
  const off = Math.hypot(x - p.x, (z - p.z) * 1.4) - RIPPLE_SPEED * age;
  if (off > 0.9 || off < -1.2) return 0;
  return p.strength * Math.exp(-age * 1.1) * Math.exp(-((off / 0.5) ** 2)) * Math.cos(off * 7);
}

export default function HeroSea() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, frame = 0, last = 0, visible = true;
    let surges = [];
    let nextSurge = 1.5;
    let ripples = [];
    const pointer = { x: 0, y: 0, on: 0, target: 0, down: false, lastX: 0, lastY: 0, lastT: 0 };

    // The flat sea plane, solved for where a screen point lands on it.
    const plane = () => {
      const horizon = h * HORIZON;
      return { horizon, focal: (h - horizon) * Z_NEAR / 0.55 };
    };

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
      surges = surges.filter((s) => t - s.born < s.life);
      if (t >= nextSurge) {
        if (surges.length < 3) surges.push(newSurge(t));
        nextSurge = t + rand(3, 9);
      }
      ripples = ripples.filter((p) => t - p.born < RIPPLE_LIFE);
      pointer.on += (pointer.target - pointer.on) * 0.12; // ease the hover swell in and out
      const { horizon, focal } = plane(); // camera height 0.55 puts the nearest row at the bottom
      const near = w < 640 ? 16 : 20; // screen gap between dots on the nearest row
      const dx = near * Z_NEAR / focal;
      const rows = w < 640 ? 40 : 56;
      for (let r = 0; r < rows; r++) {
        const z = Z_FAR - (Z_FAR - Z_NEAR) * (r / (rows - 1));
        const scale = focal / z;
        const span = (w / 2 + near) / scale;
        const fade = Math.min(1, ((Z_FAR - z) / 1.4) ** 2); // fade in softly from the horizon
        const dot = Math.max(0.7, 2.4 * Z_NEAR / z);
        for (let c = -Math.ceil(span / dx); c * dx <= span; c++) {
          const x = (c + jitter(r, c) * 0.8) * dx;
          const zz = z + jitter(c, r) * 0.6 * (Z_FAR - Z_NEAR) / rows;
          const swell = lift(x, zz, t);
          // Surges are sized on screen, so a far wave can still reach the header.
          let rise = 0, surf = 0;
          for (const s of surges) {
            const v = surgeAt(s, x, zz, t);
            rise += v * s.rise * h;
            surf = Math.max(surf, v);
          }
          for (const p of ripples) {
            const v = rippleAt(p, x, zz, t);
            if (!v) continue;
            rise += (v * 170) / zz; // nearer ripples look bigger
            surf = Math.max(surf, Math.min(1, Math.abs(v) * 1.6));
          }
          const sx = w / 2 + x * scale;
          let sy = horizon + (0.55 - swell) * focal / zz - rise;
          if (pointer.on > 0.01) {
            const d = Math.hypot(sx - pointer.x, sy - pointer.y);
            if (d < HOVER_RADIUS) {
              const k = (1 - d / HOVER_RADIUS) ** 2 * pointer.on;
              sy -= k * 48;
              surf = Math.max(surf, k);
            }
          }
          if (sy > h + 4 || sy < -4) continue;
          // Crests catch the light: brighter, and warmer toward ochre.
          const crest = Math.max(0, swell / 0.2, surf);
          ctx.globalAlpha = Math.max(fade, surf) * (0.2 + 0.55 * Math.min(1, crest));
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
    draw(0);
    start();

    // Dragging (or swiping on touch) across the hero stirs the water.
    const hero = canvas.parentElement;
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    const splash = (px, py, strength, t) => {
      const { horizon, focal } = plane();
      if (py < horizon + 4) return;
      const z = Math.min(Z_FAR, Math.max(Z_NEAR, (0.55 * focal) / (py - horizon)));
      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({ x: ((px - w / 2) * z) / focal, z, born: t, strength });
    };
    const onMove = (e) => {
      const [px, py] = local(e);
      pointer.x = px;
      pointer.y = py;
      pointer.target = 1;
      if (!pointer.down) return;
      const now = performance.now();
      const moved = Math.hypot(px - pointer.lastX, py - pointer.lastY);
      if (moved < 18 && now - pointer.lastT < 60) return;
      // Faster drags make stronger ripples.
      const speed = moved / Math.max(16, now - pointer.lastT);
      splash(px, py, Math.min(1, Math.max(0.35, speed / 1.2)), now / 1000);
      Object.assign(pointer, { lastX: px, lastY: py, lastT: now });
    };
    const onDown = (e) => {
      if (e.pointerType === "mouse" && e.target.closest("a, button, input, textarea, select")) return;
      if (e.pointerType === "mouse") e.preventDefault(); // no text selection while stirring
      const [px, py] = local(e);
      const now = performance.now();
      Object.assign(pointer, { down: true, lastX: px, lastY: py, lastT: now });
      hero.classList.add("is-stirring");
      splash(px, py, 1, now / 1000);
    };
    const onUp = () => {
      pointer.down = false;
      hero.classList.remove("is-stirring");
    };
    const onLeave = () => {
      pointer.target = 0;
      onUp();
    };
    if (!still) {
      hero.addEventListener("pointermove", onMove);
      hero.addEventListener("pointerdown", onDown);
      hero.addEventListener("pointerleave", onLeave);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    }

    const ro = new ResizeObserver(() => { size(); draw(last / 1000); });
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
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerdown", onDown);
      hero.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return <canvas ref={ref} className="sea" aria-hidden="true" />;
}

"use client";

import { useEffect, useRef } from "react";

const DURATION = 1400;

// Shapes the count: t runs 0 → 1 over DURATION, return how far the number has got (0 → 1).
function ease(t) {
  // TODO(Karl): pick the feel of the count-up. Linear works but ends abruptly.
  return t;
}

// Server renders the real figure (for SEO and no-JS). Only figures that start below the
// fold count up, so a number already on screen never blinks back to zero.
export default function CountUp({ value, locale = "en-PH" }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame;
    let first = true;
    const io = new IntersectionObserver(([entry]) => {
      if (first) {
        first = false;
        if (entry.isIntersecting) return io.disconnect();
        el.textContent = (0).toLocaleString(locale);
        return;
      }
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / DURATION);
        el.textContent = Math.round(value * ease(t)).toLocaleString(locale);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = value.toLocaleString(locale);
    };
  }, [value, locale]);

  return <span className="v" ref={ref}>{value.toLocaleString(locale)}</span>;
}

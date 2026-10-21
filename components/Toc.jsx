"use client";

import { useEffect, useState } from "react";

// "On this page" list that marks the section you are reading.
export default function Toc({ headings }) {
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter(Boolean);
    // A heading counts as current once it passes the top third of the screen.
    const io = new IntersectionObserver((entries) => {
      const above = els.filter((el) => el.getBoundingClientRect().top < innerHeight / 3);
      setCurrent(above.at(-1)?.id ?? null);
    }, { rootMargin: "0px 0px -66% 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [headings]);

  return (
    <nav className="toc" aria-label="On this page">
      <p className="acard__cat">On this page</p>
      <ol>
        {headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} aria-current={current === h.id ? "location" : undefined}>{h.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

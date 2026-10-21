"use client";

import { useState } from "react";

export default function FaqList({ faqs }) {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="faq__list">
      {faqs.map((f, i) => {
        const open = openIndex === i;
        return (
          <div className={"faq__item" + (open ? " open" : "")} key={f.question}>
            <button className="faq__q" aria-expanded={open} onClick={() => setOpenIndex(open ? -1 : i)}>
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span className="q">{f.question}</span>
              <span className="m" aria-hidden="true">{open ? "−" : "+"}</span>
            </button>
            <div className="faq__panel" inert={!open}><p className="faq__a">{f.answer}</p></div>
          </div>
        );
      })}
    </div>
  );
}

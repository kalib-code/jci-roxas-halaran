import { useState } from "react";
import Contours from "../components/Contours.jsx";
import { faqs, LOGO, FACEBOOK_URL } from "../data/site.js";

export default function Join() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <>
      {/* CTA HERO */}
      <header className="join-hero">
        <Contours variant="join" />
        <div className="join-hero__inner">
          <img src={LOGO} alt="JCI Roxas Halaran" />
          <h1 className="join-hero__title">Become a<br />member</h1>
          <p className="join-hero__copy">Join a worldwide network of young active citizens creating positive change — starting right here in Roxas City.</p>
          <a className="btn btn--lg" href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer">Contact Now</a>
        </div>
      </header>

      {/* FAQ */}
      <section id="faq" className="dune section">
        <div className="faq__grid">
          <div className="faq__head">
            <span className="label">FAQ — Concerns</span>
            <h2>Frequently asked questions</h2>
          </div>
          <div className="faq__list">
            {faqs.map((f, i) => {
              const open = openIndex === i;
              return (
                <div className={"faq__item" + (open ? " open" : "")} key={f.q}>
                  <button
                    className="faq__q"
                    aria-expanded={open}
                    onClick={() => setOpenIndex(open ? -1 : i)}
                  >
                    <span className="n">{String(i + 1).padStart(2, "0")}</span>
                    <span className="q">{f.q}</span>
                    <span className="m">{open ? "−" : "+"}</span>
                  </button>
                  <p className="faq__a">{f.a}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="baseline">
        <span>JCI Roxas Halaran — Roxas City, Capiz, 5800</span>
        <span>Leadership · Entrepreneurship</span>
      </footer>
    </>
  );
}

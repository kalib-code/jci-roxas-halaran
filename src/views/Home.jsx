import { Link } from "react-router-dom";
import Contours from "../components/Contours.jsx";
import { pillars, projects, stats, awards, LOGO, ABOUT_PHOTO } from "../data/site.js";

export default function Home() {
  return (
    <>
      {/* HERO */}
      <header className="hero">
        <Contours variant="hero" />
        <div className="hero__inner">
          <h1 className="hero__title">JCI Roxas<br />Halaran<em>.</em></h1>
          <div className="hero__meta">
            <span>Based in Roxas City,<br />Capiz, 5800</span>
            <span>Available all around<br />worldwide</span>
            <span>Leadership<br />Entrepreneurship</span>
            <Link className="btn" to="/join">Become a Member →</Link>
          </div>
        </div>
      </header>

      {/* 01 ABOUT */}
      <section id="about" className="section section--line-top">
        <div className="crumbs label">
          <span className="num">01</span><span className="mid">About Us</span><span className="end">JCI Halaran</span>
        </div>
        <div className="about__grid">
          <h2>We are a Capiz-based JCI chapter</h2>
          <p>Connecting members worldwide through shared values and empowering them to create positive change and opportunities on a global scale.</p>
        </div>
        <div className="pillars">
          {pillars.map((p) => (
            <div className="pillar" key={p.num}>
              <span className="num">{p.num}</span>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHAT IS — DUNE PANEL */}
      <section className="dune section">
        <div className="dune__grid">
          <div className="dune__col">
            <span className="label">What is JCI Roxas Halaran</span>
            <p className="dune__lede">We are a Capiz based JCI chapter that connects its members through a worldwide network, uniting them through a shared set of core values laid out in the JCI Creed. JCI pushes its members to overcome challenges, create opportunity from adversity, and provide meaningful improvement at a global scale.</p>
            <div className="dune__stats">
              <div className="dune__stat">
                <span className="v">50+</span>
                <span className="l">Initiated local projects</span>
              </div>
              <div className="dune__stat">
                <span className="v">2023</span>
                <span className="l">Operating and active since</span>
              </div>
            </div>
            <p className="dune__note">The Philippine Jaycees, now JCI Philippines, is the first nationally organized leadership development organization in Asia. JCI Halaran is an emerging affiliate aimed at enforcing area-spanning schemes and connections for community development.</p>
          </div>
          <div className="dune__photo">
            <img src={ABOUT_PHOTO} alt="JCI Halaran chapter activity" />
          </div>
        </div>
      </section>

      {/* 02 PROJECTS */}
      <section id="projects" className="section">
        <div className="section__bar">
          <h2>Our community projects</h2>
          <span className="label">02 — Projects</span>
        </div>
        <div className="projects">
          {projects.map((pr) => (
            <article className="project" key={pr.title}>
              <figure><img src={pr.img} alt={pr.title} loading="lazy" /></figure>
              <div className="project__meta">
                <h3>{pr.title}</h3>
                <span className="label label--sm">{pr.date}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 03 QUOTE */}
      <section className="quote">
        <Contours variant="quote" />
        <div className="quote__inner">
          <span className="label">03 — Our Goal</span>
          <p className="quote__text">Great leaders don't set out to be a leader… they set out to make a difference.</p>
        </div>
      </section>

      {/* 04 STATS */}
      <section className="section section--line-bottom">
        <div className="crumbs label">
          <span className="num">04</span><span className="mid">Stats</span><span className="end">Fun Facts</span>
        </div>
        <div className="stats">
          {stats.map((st) => (
            <div className="stat" key={st.label}>
              <span className="v">{st.value}</span>
              <span className="l">{st.label}</span>
            </div>
          ))}
        </div>
        <p className="stats__mission">Our mission is to connect, inspire, and empower young active citizens to create positive change in their communities and around the world.</p>
      </section>

      {/* 05 AWARDS */}
      <section className="section">
        <div className="section__bar">
          <h2>Recognition</h2>
          <span className="label">05 — Awards</span>
        </div>
        <div>
          {awards.map((aw) => (
            <div className="award" key={aw.title}>
              <span className="t">{aw.title}</span>
              <span className="by">{aw.by}</span>
              <span className="y">{aw.year}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA + FOOTER */}
      <footer className="cta-footer">
        <div className="cta-footer__inner">
          <img src={LOGO} alt="JCI Roxas Halaran" />
          <h2 className="cta-footer__title">Become a<br />member</h2>
          <Link className="btn btn--lg" to="/join">Contact Now</Link>
        </div>
        <div className="baseline">
          <span>JCI Roxas Halaran — Roxas City, Capiz, 5800</span>
          <span>Leadership · Entrepreneurship</span>
        </div>
      </footer>
    </>
  );
}

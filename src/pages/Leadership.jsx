import { Link } from "react-router-dom";
import { officers, PRESIDENT_PHOTO } from "../data/site.js";

export default function Leadership() {
  return (
    <>
      {/* 01 PRESIDENT */}
      <section className="president section">
        <div className="crumbs label">
          <span className="num">01</span><span className="mid">Our Leadership</span><span className="end">JCI Halaran</span>
        </div>
        <div className="president__grid">
          <div className="president__photo">
            <figure><img src={PRESIDENT_PHOTO} alt="Lemuel J. Capa" /></figure>
            <span className="label label--sm">Lemuel J. Capa — 2025 Local Organization President, JCI Roxas Halaran</span>
          </div>
          <div className="president__body">
            <h1>About our president</h1>
            <p className="bio">Lemuel Capa leads JCI Roxas Halaran in 2025 with a clear mission: to empower, uplift, and transform the next generation of leaders. Grounded in servant leadership and driven by purpose, he champions the call to “Lead, Excel, Motivate,” inspiring others through action and heart.</p>
            <blockquote>“Leadership is not a title, it's a mission—Lead with purpose, Excel with passion, Motivate with heart—transforming young leaders, ONE VISION, ONE MILESTONE at a time.”</blockquote>
            <p className="close">As President, Lemuel is committed to building a chapter that thrives on unity, service, and visionary leadership—one that leads change not just in the community, but in the lives of every young leader it touches.</p>
          </div>
        </div>
      </section>

      {/* 02 OFFICERS */}
      <section className="section">
        <div className="section__bar">
          <h2>Our officers</h2>
          <span className="label">02 — Board 2025</span>
        </div>
        <div className="officers">
          {officers.map((o) => (
            <div className="officer" key={o.name}>
              <figure><img src={o.img} alt={o.name} loading="lazy" /></figure>
              <div className="officer__meta">
                <span className="name">{o.name}</span>
                <span className="role">{o.role}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="baseline">
        <span>JCI Roxas Halaran — Roxas City, Capiz, 5800</span>
        <Link to="/join">Become a Member →</Link>
      </footer>
    </>
  );
}

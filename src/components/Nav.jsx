import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { LOGO, FACEBOOK_URL } from "../data/site.js";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const onJoin = pathname === "/join";
  const close = () => setOpen(false);

  return (
    <nav className="nav">
      <Link className="nav__logo" to="/" aria-label="JCI Roxas Halaran — home" onClick={close}>
        <img src={LOGO} alt="JCI Roxas Halaran" />
      </Link>
      <button
        className="nav__burger"
        aria-label="Open menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span></span><span></span><span></span>
      </button>
      <div className={"nav__links" + (open ? " open" : "")}>
        <Link to="/#about" onClick={close}>About</Link>
        <Link to="/#projects" onClick={close}>Projects</Link>
        <NavLink to="/leadership" onClick={close}>Leadership</NavLink>
        <Link to="/join#faq" className={onJoin ? "active" : ""} onClick={close}>FAQ</Link>
        {onJoin ? (
          <a className="btn" href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" onClick={close}>Contact Now</a>
        ) : (
          <Link className="btn" to="/join" onClick={close}>Become a Member</Link>
        )}
      </div>
    </nav>
  );
}

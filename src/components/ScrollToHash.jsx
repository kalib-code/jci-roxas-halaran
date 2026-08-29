import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// On route change: jump to the URL hash if present, otherwise scroll to top.
export default function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

// JCI Roxas Halaran — interactions

// Sticky nav background once the page scrolls past the hero's top edge
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Scroll-reveal via IntersectionObserver; falls back to visible-by-default
const revealed = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
  );
  revealed.forEach((el) => io.observe(el));
} else {
  revealed.forEach((el) => el.classList.add("in"));
}

// Mobile menu
const burger = document.querySelector(".nav__burger");
const menu = document.querySelector(".mobile-menu");
const setMenu = (open) => {
  burger.setAttribute("aria-expanded", String(open));
  menu.hidden = !open;
  document.body.style.overflow = open ? "hidden" : "";
};
burger.addEventListener("click", () => {
  setMenu(burger.getAttribute("aria-expanded") !== "true");
});
menu.querySelectorAll("a").forEach((link) =>
  link.addEventListener("click", () => setMenu(false))
);

// Only one FAQ item open at a time
const faqItems = document.querySelectorAll(".faq__list details");
faqItems.forEach((item) =>
  item.addEventListener("toggle", () => {
    if (!item.open) return;
    faqItems.forEach((other) => {
      if (other !== item) other.open = false;
    });
  })
);

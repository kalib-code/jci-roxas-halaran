// JCI Roxas Halaran — site behavior

// Mobile menu
const burger = document.querySelector(".nav__burger");
const links = document.querySelector(".nav__links");
if (burger && links) {
  burger.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") !== "true";
    burger.setAttribute("aria-expanded", String(open));
    links.classList.toggle("open", open);
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      burger.setAttribute("aria-expanded", "false");
      links.classList.remove("open");
    })
  );
}

// FAQ accordion — one item open at a time, matching the design's toggle state
const faqItems = document.querySelectorAll(".faq__item");
faqItems.forEach((item) => {
  const btn = item.querySelector(".faq__q");
  btn.addEventListener("click", () => {
    const wasOpen = item.classList.contains("open");
    faqItems.forEach((other) => {
      other.classList.remove("open");
      other.querySelector(".faq__q").setAttribute("aria-expanded", "false");
      other.querySelector(".m").textContent = "+";
    });
    if (!wasOpen) {
      item.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      btn.querySelector(".m").textContent = "−";
    }
  });
});

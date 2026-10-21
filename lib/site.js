export const SITE = {
  name: "JCI Roxas Halaran",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://jciroxashalaran.com").replace(/\/$/, ""),
  description:
    "JCI Roxas Halaran is a Capiz-based JCI chapter of young active citizens creating positive change through leadership development, community projects and global outreach.",
  email: "roxashalaran.jci@gmail.com",
  facebookUrl: "https://www.facebook.com/profile.php?id=100089228427082",
  address: { locality: "Roxas City", region: "Capiz", postalCode: "5800", country: "PH" },
  foundedYear: 2023,
  // Current logo from the Webflow site (white wordmark + blue/teal shield, 1463×708).
  // White text: only place it on dark backgrounds (Basalt, Canopy).
  logo: "/assets/img/logo-site.png",
  ogImage: "/assets/img/about-stat-woman-wearing-glass.jpeg",
  aboutPhoto: "/assets/img/about-stat-woman-wearing-glass.jpeg",
  mission:
    "To provide leadership development opportunities that empower young people to create positive change.",
  vision: "To be the leading global network of young leaders.",
  pillars: [
    { num: "01", title: "Leadership Development", body: "Training and hands-on activities to strengthen leadership skills." },
    { num: "02", title: "Community Projects", body: "We organize local projects to address community needs." },
    { num: "03", title: "Global Outreach", body: "We engage in global initiatives to learn and share best practices." },
  ],
  stats: [
    { value: "3+", label: "Years of activity" },
    { value: "50+", label: "Successful projects" },
    { value: "10+", label: "Communities helped" },
    { value: "25+", label: "Members" },
  ],
};

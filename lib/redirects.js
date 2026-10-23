// Old Webflow URLs, plus /leadership from the vercel.app redesign.
export const REDIRECTS = [
  { source: "/about-us", destination: "/about", permanent: true },
  { source: "/our-officers", destination: "/officers", permanent: true },
  { source: "/contact", destination: "/join", permanent: true },
  { source: "/leadership", destination: "/officers", permanent: true },
];

// Google indexed the production vercel.app alias before the domain moved, so
// send that host (and only it: preview URLs keep working) to the real site.
export const HOST_REDIRECTS = [
  {
    source: "/:path*",
    has: [{ type: "host", value: "jci-roxas-halaran.vercel.app" }],
    destination: "https://www.jciroxashalaran.com/:path*",
    permanent: true,
  },
];

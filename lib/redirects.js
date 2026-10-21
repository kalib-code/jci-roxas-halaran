// Old Webflow URLs, plus /leadership from the vercel.app redesign.
export const REDIRECTS = [
  { source: "/about-us", destination: "/about", permanent: true },
  { source: "/our-officers", destination: "/officers", permanent: true },
  { source: "/contact", destination: "/join", permanent: true },
  { source: "/leadership", destination: "/officers", permanent: true },
];

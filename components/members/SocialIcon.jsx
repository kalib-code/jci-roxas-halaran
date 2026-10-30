import { BRAND_PATHS } from "@/lib/members/brand-paths.js";

// A site's logo in the text colour, or a globe for websites and brands we have no mark for.
// Decorative: the link's own text names the site.
export default function SocialIcon({ platform, size = 16 }) {
  const path = BRAND_PATHS[platform];
  return (
    <svg className="social-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {path ? (
        <path d={path} fill="currentColor" />
      ) : (
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
        </g>
      )}
    </svg>
  );
}

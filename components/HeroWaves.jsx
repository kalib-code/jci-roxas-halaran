// The sea rolling onto Roxas City's black sand, along the bottom of the hero.
// Each layer is twice the screen width and repeats exactly halfway, so sliding it
// by -50% in CSS loops without a seam.
const WIDTH = 2880;
const HEIGHT = 200;
const PERIOD = 720;

// Back to front. y = resting waterline, amp = wave height (in a 200-tall box).
const LAYERS = [
  { name: "far", y: 62, amp: 20 },
  { name: "mid", y: 98, amp: 24 },
  { name: "sand", y: 140, amp: 13 },
];

// A smooth sine-like line: one quadratic hump, then T keeps mirroring it.
function wave(y, amp) {
  let d = `M0,${y} Q${PERIOD / 4},${y - amp} ${PERIOD / 2},${y}`;
  for (let x = PERIOD; x <= WIDTH; x += PERIOD / 2) d += ` T${x},${y}`;
  return d;
}

const fill = (y, amp) => `${wave(y, amp)} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`;

export default function HeroWaves() {
  return (
    <div className="waves" aria-hidden="true">
      {LAYERS.map(({ name, y, amp }) => (
        <svg key={name} className={`waves__layer waves__layer--${name}`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
          {name === "sand" && (
            <defs>
              <pattern id="black-sand" width="9" height="7" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="0.7" fill="#ede8df" opacity="0.35" />
                <circle cx="6.5" cy="5" r="0.5" fill="#ede8df" opacity="0.2" />
              </pattern>
            </defs>
          )}
          <path d={fill(y, amp)} />
          {name === "mid" && <path className="waves__crest" d={wave(y, amp)} />}
          {name === "sand" && (
            <>
              <path className="waves__grain" d={fill(y, amp)} fill="url(#black-sand)" />
              <path className="waves__foam" d={wave(y, amp)} />
            </>
          )}
        </svg>
      ))}
    </div>
  );
}

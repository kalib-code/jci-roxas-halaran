// Topographic contour-line backdrop from the Coastal Canopy & Basalt system.
const SETS = {
  hero: {
    viewBox: "0 0 1440 800",
    stroke: "#3A6B4F",
    width: 1.2,
    paths: [
      "M-50,620 C250,540 420,700 720,610 S1180,480 1500,560",
      "M-50,560 C260,470 450,640 740,545 S1190,410 1500,490",
      "M-50,500 C280,400 480,580 760,480 S1200,340 1500,420",
      "M-50,440 C300,330 510,520 780,415 S1210,270 1500,350",
      "M-50,380 C320,260 540,460 800,350 S1220,200 1500,280",
      "M-50,320 C340,200 570,400 820,285 S1230,130 1500,210",
      "M-50,260 C360,140 600,340 840,220 S1240,60 1500,140",
    ],
  },
  quote: {
    viewBox: "0 0 1440 400",
    stroke: "#EDE8DF",
    width: 1,
    paths: [
      "M-50,300 C300,220 500,360 800,270 S1200,160 1500,240",
      "M-50,230 C320,140 530,300 820,200 S1210,90 1500,170",
      "M-50,160 C340,60 560,240 840,130 S1220,20 1500,100",
    ],
  },
  join: {
    viewBox: "0 0 1440 600",
    stroke: "#3A6B4F",
    width: 1.2,
    paths: [
      "M-50,460 C300,380 500,520 800,430 S1200,320 1500,400",
      "M-50,390 C320,300 530,460 820,360 S1210,250 1500,330",
      "M-50,320 C340,220 560,400 840,290 S1220,180 1500,260",
      "M-50,250 C360,140 590,340 860,220 S1230,110 1500,190",
    ],
  },
};

export default function Contours({ variant }) {
  const { viewBox, stroke, width, paths } = SETS[variant];
  return (
    <svg className="contours" viewBox={viewBox} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g fill="none" stroke={stroke} strokeWidth={width}>
        {paths.map((d) => <path key={d} d={d} />)}
      </g>
    </svg>
  );
}

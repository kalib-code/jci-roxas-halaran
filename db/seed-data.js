const img = (name) => `/assets/img/${name}`;

export const MEMBERS = [
  {
    slug: "lemuel-capa",
    name: "Lemuel J. Capa",
    photoUrl: img("president-lemuel-capa.jpg"),
    bio: "Lemuel Capa led JCI Roxas Halaran in 2025 with a clear mission: to empower, uplift, and transform the next generation of leaders. Grounded in servant leadership and driven by purpose, he championed the call to “Lead, Excel, Motivate,” inspiring others through action and heart.\n\nAs President, Lemuel built a chapter that thrives on unity, service, and visionary leadership—one that leads change not just in the community, but in the lives of every young leader it touches.",
    quote: "Leadership is not a title, it's a mission—Lead with purpose, Excel with passion, Motivate with heart—transforming young leaders, ONE VISION, ONE MILESTONE at a time.",
  },
  { slug: "john-paul-sorongon", name: "John Paul Sorongon" },
  { slug: "jaime-altavas", name: "Jaime Cortes Altavas", photoUrl: img("officer-jaime-cortes-altavas.jpg") },
  { slug: "mark-vincent-bernas", name: "Mark Vincent D. Bernas", photoUrl: img("officer-mark-vincent-bernas.jpg") },
  { slug: "john-moses-aposaga", name: "John Moses B. Aposaga", photoUrl: img("officer-john-moses-aposaga.jpg") },
  { slug: "gian-carlo-velado", name: "Gian Carlo Velado", photoUrl: img("officer-gian-carlo-velado.jpg") },
  { slug: "joshua-kenneth-anas", name: "Joshua Kenneth Anas", photoUrl: img("officer-joshua-kenneth-anas.jpg") },
  { slug: "elmer-jimenez-jr", name: "Elmer D. Jimenez Jr.", photoUrl: img("officer-elmer-jimenez-jr.jpg") },
  { slug: "miko-miguel-ramos", name: "Miko Miguel H. Ramos", photoUrl: img("officer-miko-miguel-ramos.jpg") },
  { slug: "christopher-bryan-bernas", name: "Christopher Bryan C. Bernas", photoUrl: img("officer-christopher-bernas.jpg") },
  { slug: "jasper-sayo", name: "Jasper L. Sayo", photoUrl: img("officer-jasper-sayo.jpg") },
  { slug: "eugenio-dalida-jr", name: "Eugenio Dalida Jr.", photoUrl: img("officer-eugenio-dalida-jr.jpg") },
  { slug: "raymark-bigcas", name: "Raymark B. Bigcas", photoUrl: img("officer-raymark-bigcas.jpg") },
  { slug: "jaime-miguel-dadivas", name: "Jaime Miguel Dadivas" },
  { slug: "johbert-flores", name: "Johbert Flores" },
  { slug: "judy-daliva", name: "Judy Daliva" },
  { slug: "manuel-luis-luna", name: "Manuel Luis Luna" },
];

// [member slug, role] in display order; index = sort.
const BOARDS = {
  2024: [["john-paul-sorongon", "President"]],
  2025: [
    ["lemuel-capa", "President"],
    ["mark-vincent-bernas", "Executive Vice President"],
    ["john-moses-aposaga", "VP Internal"],
    ["jaime-altavas", "VP External"],
    ["gian-carlo-velado", "Secretary"],
    ["joshua-kenneth-anas", "Treasurer"],
    ["elmer-jimenez-jr", "Auditor"],
    ["miko-miguel-ramos", "BOD Social Media & Marketing"],
    ["christopher-bryan-bernas", "BOD Membership"],
    ["jasper-sayo", "BOD Community"],
    ["eugenio-dalida-jr", "BOD International"],
    ["raymark-bigcas", "Local Skills Development Director"],
  ],
  2026: [
    ["jaime-altavas", "President"],
    ["mark-vincent-bernas", "Executive Vice President"],
    ["jasper-sayo", "Vice President"],
    ["raymark-bigcas", "Vice President"],
    ["john-moses-aposaga", "Secretary"],
    ["christopher-bryan-bernas", "Treasurer"],
    ["gian-carlo-velado", "Local Skills Development Director"],
    ["elmer-jimenez-jr", "Director"],
    ["eugenio-dalida-jr", "Director"],
    ["jaime-miguel-dadivas", "Director"],
    ["johbert-flores", "Director"],
    ["judy-daliva", "Director"],
    ["manuel-luis-luna", "Director"],
  ],
};

export const TERMS = Object.entries(BOARDS).flatMap(([year, rows]) =>
  rows.map(([member, role], sort) => ({ member, role, year: Number(year), sort })),
);

export const PROJECTS = [
  { slug: "mural-marker-inauguration", title: "Mural Marker Inauguration", startDate: "2026-08-07" },
  { slug: "sampukanay-2026", title: "Sampukanay 2026", startDate: "2026-07-11" },
  { slug: "symposium-on-mens-mental-health", title: "Symposium on Men's Mental Health", startDate: "2026-06-30" },
  { slug: "provincial-arbor-day-2026", title: "Provincial Arbor Day 2026", startDate: "2026-06-25" },
  { slug: "talentadong-tatay-2026", title: "Talentadong Tatay 2026", startDate: "2026-06-21" },
  { slug: "coastline-cuts", title: "Coastline Cuts", startDate: "2026-06-20" },
  {
    slug: "ironmen-awards-2025",
    title: "IRONMEN Awards 2025",
    startDate: "2025-07-08",
    coverUrl: img("project-ironmen-awards-2025.jpg"),
    coverAlt: "IRONMEN Awards 2025 ceremony",
  },
  {
    slug: "be-a-friend-not-a-bully",
    title: "“Be a Friend, Not a Bully”",
    startDate: "2025-07-04",
    coverUrl: img("project-be-a-friend-not-a-bully.jpg"),
    coverAlt: "“Be a Friend, Not a Bully” anti-bullying campaign",
  },
  {
    slug: "friends-x-jci-roxas-halaran",
    title: "FRIENDS x JCI Roxas Halaran",
    startDate: "2025-06-07",
    coverUrl: img("project-friends-x-jci-roxas-halaran.jpg"),
    coverAlt: "FRIENDS x JCI Roxas Halaran event",
  },
  { slug: "sa-dagat", title: "SA DAGAT" },
  { slug: "hapag-ng-daigdig", title: "Hapag ng Daigdig" },
];

export const FAQS = [
  ["What is JCI?", "JCI (Junior Chamber International) is a worldwide organization of young active citizens aged 18 to 40 who take collective action to improve themselves and the world around them."],
  ["Who can join JCI?", "Anyone aged 18 to 40 who wants to develop leadership skills and create positive change in the community."],
  ["How do I become a member?", "Reach out through our Facebook page or email, or attend one of our events — we'll walk you through the membership process from there."],
  ["What are the benefits of joining JCI?", "Leadership training, hands-on project experience, entrepreneurship opportunities, and access to a worldwide network of young leaders."],
  ["Is there a membership fee?", "Yes — an annual fee covers local and international dues. Contact us for current rates."],
  ["What kind of projects does JCI organize?", "Community development projects, youth advocacy campaigns like “Be a Friend, Not a Bully,” leadership trainings, and partnership events across the region."],
  ["How can I participate in JCI events?", "Follow our Facebook page for announcements — most events are open to guests and prospective members."],
  ["Can I join JCI if I have no leadership experience?", "Absolutely. JCI exists to develop leaders — training and hands-on opportunities are what membership is for."],
  ["How can my business or organization partner with JCI?", "Email us or message our Facebook page — we welcome partnerships for community projects, sponsorships, and joint initiatives."],
].map(([question, answer], sort) => ({ question, answer, sort }));

export const AWARDS = [
  { title: "Nominated Top 5 Best Local Organization Website", awardedBy: "Temiong Awards", year: 2024 },
  { title: "Nominated Top 5 Most Outstanding Local Organization", awardedBy: "Quadro Awards", year: 2024 },
  { title: "Star Local President — Lemuel Capa", awardedBy: "JCI Philippines", year: 2025 },
  { title: "Star Local President — John Paul Sorongon", awardedBy: "JCI Philippines", year: 2024 },
];

export const SPONSORS = [
  { name: "Tuyo De Capiz" },
  { name: "RXS Seafood Hub" },
  { name: "Spaces Studio" },
  { name: "CAPA Dance Academy" },
];

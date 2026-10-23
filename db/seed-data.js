const img = (name) => `/assets/img/${name}`;

// 2026 board portraits, taken from the Webflow officers page (2026-10-21).
const SLUGS_2026 = [
  "jaime-altavas", "mark-vincent-bernas", "jasper-sayo", "raymark-bigcas", "john-moses-aposaga",
  "christopher-bryan-bernas", "gian-carlo-velado", "elmer-jimenez-jr", "eugenio-dalida-jr",
  "jaime-miguel-dadivas", "johbert-flores", "judy-daliva", "manuel-luis-luna",
];
export const OFFICER_PHOTOS_2026 = Object.fromEntries(SLUGS_2026.map((s) => [s, img(`officer-2026-${s}.jpg`)]));

export const MEMBERS = [
  {
    slug: "lemuel-capa",
    name: "Lemuel J. Capa",
    photoUrl: img("president-lemuel-capa.jpg"),
    bio: "Lemuel Capa led JCI Roxas Halaran in 2025 with a clear mission: to empower, uplift, and transform the next generation of leaders. Grounded in servant leadership and driven by purpose, he championed the call to “Lead, Excel, Motivate,” inspiring others through action and heart.\n\nAs President, Lemuel built a chapter that thrives on unity, service, and visionary leadership—one that leads change not just in the community, but in the lives of every young leader it touches.",
    quote: "Leadership is not a title, it's a mission—Lead with purpose, Excel with passion, Motivate with heart—transforming young leaders, ONE VISION, ONE MILESTONE at a time.",
  },
  { slug: "john-paul-sorongon", name: "John Paul Sorongon" },
  { slug: "jaime-altavas", name: "Jaime Cortes M. Altavas", photoUrl: img("officer-jaime-cortes-altavas.jpg") },
  { slug: "mark-vincent-bernas", name: "Mark Vincent D. Bernas", photoUrl: img("officer-mark-vincent-bernas.jpg") },
  { slug: "john-moses-aposaga", name: "John Moses Aposaga", photoUrl: img("officer-john-moses-aposaga.jpg") },
  { slug: "gian-carlo-velado", name: "Gian Carlo L. Velado", photoUrl: img("officer-gian-carlo-velado.jpg") },
  { slug: "joshua-kenneth-anas", name: "Joshua Kenneth Anas", photoUrl: img("officer-joshua-kenneth-anas.jpg") },
  { slug: "elmer-jimenez-jr", name: "Elmer F. Jimenez, Jr.", photoUrl: img("officer-elmer-jimenez-jr.jpg") },
  { slug: "miko-miguel-ramos", name: "Miko Miguel H. Ramos", photoUrl: img("officer-miko-miguel-ramos.jpg") },
  { slug: "christopher-bryan-bernas", name: "Christopher Bryan C. Bernas", photoUrl: img("officer-christopher-bernas.jpg") },
  { slug: "jasper-sayo", name: "Jasper T. Sayo", photoUrl: img("officer-jasper-sayo.jpg") },
  { slug: "eugenio-dalida-jr", name: "Eugenio N. Dalida, Jr.", photoUrl: img("officer-eugenio-dalida-jr.jpg") },
  { slug: "raymark-bigcas", name: "Raymark B. Bigcas", photoUrl: img("officer-raymark-bigcas.jpg") },
  { slug: "jaime-miguel-dadivas", name: "Jaime Miguel Dadivas" },
  { slug: "johbert-flores", name: "Johbert T. Flores" },
  { slug: "judy-daliva", name: "Judy J. Daliva" },
  { slug: "manuel-luis-luna", name: "Manuel Luis Luna" },
].map((m) => (OFFICER_PHOTOS_2026[m.slug] ? { ...m, photoUrl: OFFICER_PHOTOS_2026[m.slug] } : m));

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
  // From the chapter's "Introducing Our 2026 Board of Directors" post.
  2026: [
    ["jaime-altavas", "President"],
    ["lemuel-capa", "Immediate Past President"],
    ["mark-vincent-bernas", "Executive Vice President"],
    ["raymark-bigcas", "Vice President for Internal"],
    ["jasper-sayo", "Vice President for External"],
    ["john-moses-aposaga", "Secretary"],
    ["christopher-bryan-bernas", "Treasurer"],
    ["elmer-jimenez-jr", "Auditor"],
    ["judy-daliva", "Director for Membership"],
    ["johbert-flores", "Director for Social Media & Marketing"],
    ["eugenio-dalida-jr", "Director for Internationalism"],
    ["manuel-luis-luna", "Director for Community"],
    ["gian-carlo-velado", "Local Skills Development Director"],
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

// From the chapter's Facebook page (content/FACEBOOK-ACTIVITIES.md, 2026-10-21).
export const AWARDS = [
  { title: "JCIPEA Diamond Seal of Efficiency", awardedBy: "JCI Philippines National Convention", year: 2026 },
  { title: "JCIPEA Gavel", awardedBy: "JCI Philippines National Convention", year: 2026 },
  { title: "CWAS Implementation Award", awardedBy: "JCI Philippines National Convention", year: 2026 },
  { title: "Sinagtala Award, 1st Runner-Up, Best Digital Marketing Campaign (HALAD AUDIO LAB)", awardedBy: "Temiong Awards", year: 2026 },
  { title: "Top 10 National Program Implementers, Visayas Area", awardedBy: "JCI Philippines", year: 2026 },
  { title: "Star President — Lemuel Capa", awardedBy: "JCI", year: 2025 },
  { title: "Star Member — John Moses Aposaga", awardedBy: "JCI", year: 2025 },
  { title: "Quadro Award, Best Educational Program (The Nutcracker)", awardedBy: "Quadro Awards", year: 2024 },
  { title: "Nominated Top 5 Most Outstanding Local Organization", awardedBy: "Quadro Awards", year: 2024 },
  { title: "Nominated Top 5 Most Outstanding Local Organization Website", awardedBy: "Quadro Awards", year: 2024 },
  { title: "Nominated Top 5 Most Outstanding Local Organization President", awardedBy: "Quadro Awards", year: 2024 },
  { title: "Star Local President — John Paul Sorongon", awardedBy: "JCI World Congress", year: 2024 },
  { title: "JCI Senator — John Paul C. Sorongon", awardedBy: "JCI", year: 2024 },
];

export const SPONSORS = [
  { name: "Tuyo De Capiz" },
  { name: "RXS Seafood Hub" },
  { name: "Spaces Studio" },
  { name: "CAPA Dance Academy" },
];

// [month, keyword, volume, kd, working title] from the Obsidian note
// "JCI Roxas Halaran — SEO Keyword Plan (10 per month)" (PH data, 2026-10-21).
export const SEO_PLAN = [
  ["2026-10", "jci meaning", 1000, 16, "JCI meaning: what JCI stands for"],
  ["2026-10", "how to join jci", 30, null, "How to join JCI in the Philippines"],
  ["2026-10", "jci roxas", null, null, "The JCI chapters of Roxas City and Capiz"],
  ["2026-11", "halaran festival", 140, 10, "Sinadya sa Halaran festival guide"],
  ["2026-11", "bonifacio day", 14800, 0, "Bonifacio Day (Nov 30): history and meaning"],
  ["2026-11", "rizal day", 12100, 0, "Rizal Day (Dec 30): what Filipinos commemorate"],
  ["2026-11", "roxas city capiz", 27100, 0, "Roxas City, Capiz: a local's guide"],
  ["2026-11", "seafood capital of the philippines", 1600, 4, "Why Roxas City is the Seafood Capital of the Philippines"],
  ["2026-11", "baybay beach roxas city", 3600, 0, "Capiz tourist spots: Baybay Beach, Olotayan Island and more"],
  ["2026-11", "typhoon preparedness", 1000, 0, "Typhoon preparedness checklist for Capiz families"],
  ["2026-11", "anti bullying act", 4400, 0, "The Anti-Bullying Act explained"],
  ["2026-11", "jci philippines", 2400, 30, "What is JCI? JCI in the Philippines"],
  ["2026-11", "project proposal sample", 12100, 6, "Community project proposal sample (free template)"],
  ["2026-12", "manuel roxas", 33100, 1, "Manuel Roxas: the Capiz-born president"],
  ["2026-12", "capiz", 22200, 0, "A short history of Capiz"],
  ["2026-12", "capiz shells", 6600, 0, "Capiz shells: from Roxas City to the world"],
  ["2026-12", "dti business registration", 6600, 10, "DTI business registration guide"],
  ["2026-12", "entrepreneurship in the philippines", 4400, 0, "Entrepreneurship in the Philippines"],
  ["2026-12", "negosyo ideas", 2900, 0, "20 negosyo ideas for the province"],
  ["2026-12", "sponsorship letter", 1600, 0, "Sponsorship letter sample"],
  ["2026-12", "volunteer philippines", 1300, 16, "Volunteer opportunities in Capiz and the Philippines"],
  ["2026-12", "event proposal", 720, 0, "Event proposal template"],
  ["2026-12", "jci roxas halaran", null, null, "JCI Roxas Halaran 2026 year in review"],
  ["2027-01", "araw ng kagitingan", 27100, 6, "Araw ng Kagitingan (Apr 9): the story of Bataan"],
  ["2027-01", "labor day philippines", 5400, 3, "Labor Day in the Philippines"],
  ["2027-01", "edsa people power anniversary", 210, null, "EDSA People Power anniversary (Feb 25)"],
  ["2027-01", "public speaking tips", 4400, 24, "Public speaking tips for first-time leaders"],
  ["2027-01", "types of leadership", 4400, 34, "Types of leadership, with Filipino examples"],
  ["2027-01", "qualities of a good leader", 2900, 15, "Qualities of a good leader"],
  ["2027-01", "ngo in the philippines", 2900, 0, "NGOs and youth organizations in the Philippines"],
  ["2027-01", "community development", 1900, 13, "Community development: how to start"],
  ["2027-01", "sdg philippines", 1000, 11, "The SDGs in the Philippines"],
  ["2027-01", "tree planting philippines", 720, 0, "How to organize a tree planting"],
].map(([month, keyword, volume, kd, workingTitle]) => ({ month, keyword, volume, kd, workingTitle }));

// All editable site content in one place.
const img = (name) => `/assets/img/${name}`;

export const pillars = [
  { num: "01", title: "Leadership Development", body: "Training and hands-on activities to strengthen leadership skills." },
  { num: "02", title: "Community Projects", body: "We organize local projects to address community needs." },
  { num: "03", title: "Global Outreach", body: "We engage in global initiatives to learn and share best practices." },
];

export const projects = [
  { img: img("project-ironmen-awards-2025.jpg"), title: "IRONMEN AWARDS 2025", date: "July 08, 2025" },
  { img: img("project-be-a-friend-not-a-bully.jpg"), title: "“Be a Friend, Not a Bully”", date: "July 04, 2025" },
  { img: img("project-friends-x-jci-roxas-halaran.jpg"), title: "FRIENDS x JCI Roxas Halaran", date: "June 7, 2025" },
];

export const stats = [
  { value: "3+", label: "Years of activity" },
  { value: "50+", label: "Successful projects" },
  { value: "10+", label: "Helped communities" },
  { value: "25+", label: "Members" },
];

export const awards = [
  { title: "Nominated Top 5 Best Local Organization Website", by: "Temiong Awards", year: "2024" },
  { title: "Nominated Top 5 Most Outstanding Local Organization", by: "Quadro Awards", year: "2024" },
  { title: "Star Local President — Lemuel Capa", by: "JCI Philippines", year: "2025" },
  { title: "Star Local President — John Paul Sorongon", by: "JCI Philippines", year: "2024" },
];

export const officers = [
  { img: img("officer-mark-vincent-bernas.jpg"), name: "Mark Vincent D. Bernas", role: "Executive VP" },
  { img: img("officer-john-moses-aposaga.jpg"), name: "John Moses B. Aposaga", role: "VP Internal" },
  { img: img("officer-jaime-cortes-altavas.jpg"), name: "Jaime Cortes Altavas", role: "VP External" },
  { img: img("officer-gian-carlo-velado.jpg"), name: "Gian Carlo Velado", role: "Secretary" },
  { img: img("officer-joshua-kenneth-anas.jpg"), name: "Joshua Kenneth Anas", role: "Treasurer" },
  { img: img("officer-elmer-jimenez-jr.jpg"), name: "Elmer D. Jimenez Jr.", role: "Auditor" },
  { img: img("officer-miko-miguel-ramos.jpg"), name: "Miko Miguel H. Ramos", role: "BOD Social Media & Marketing" },
  { img: img("officer-christopher-bernas.jpg"), name: "Christopher Bryan C. Bernas", role: "BOD Membership" },
  { img: img("officer-jasper-sayo.jpg"), name: "Jasper L. Sayo", role: "BOD Community" },
  { img: img("officer-eugenio-dalida-jr.jpg"), name: "Eugenio Dalida Jr.", role: "BOD International" },
  { img: img("officer-raymark-bigcas.jpg"), name: "Raymark B. Bigcas", role: "Local Skills Development Director" },
];

export const faqs = [
  { q: "What is JCI?", a: "JCI (Junior Chamber International) is a worldwide organization of young active citizens aged 18 to 40 who take collective action to improve themselves and the world around them." },
  { q: "Who can join JCI?", a: "Anyone aged 18 to 40 who wants to develop leadership skills and create positive change in the community." },
  { q: "How do I become a member?", a: "Reach out through our Facebook page or attend one of our events — we'll walk you through the membership process from there." },
  { q: "What are the benefits of joining JCI?", a: "Leadership training, hands-on project experience, entrepreneurship opportunities, and access to a worldwide network of young leaders." },
  { q: "Is there a membership fee?", a: "Yes — an annual fee covers local and international dues. Contact us for current rates." },
  { q: "What kind of projects does JCI organize?", a: "Community development projects, youth advocacy campaigns like “Be a Friend, Not a Bully,” leadership trainings, and partnership events across the region." },
  { q: "How can I participate in JCI events?", a: "Follow our Facebook page for announcements — most events are open to guests and prospective members." },
  { q: "Can I join JCI if I have no leadership experience?", a: "Absolutely. JCI exists to develop leaders — training and hands-on opportunities are what membership is for." },
  { q: "How can my business or organization partner with JCI?", a: "Message us through our contact page — we welcome partnerships for community projects, sponsorships, and joint initiatives." },
];

export const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=100089228427082";
export const LOGO = img("logo-dc.png");
export const ABOUT_PHOTO = img("about-stat-woman-wearing-glass.jpeg");
export const PRESIDENT_PHOTO = img("president-lemuel-capa.jpg");

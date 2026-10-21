import HomePage from "@/components/pages/HomePage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { SITE } from "@/lib/site.js";
import { languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: { absolute: t("en", "home.title") },
  description: SITE.description,
  path: "/",
  languages: languageAlternates("/"),
});

export default function Home() {
  return <HomePage lang="en" />;
}

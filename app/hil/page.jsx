import { notFound } from "next/navigation";
import HomePage from "@/components/pages/HomePage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { hilEnabled, languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: { absolute: t("hil", "home.title") },
  description: t("hil", "home.statement"),
  path: "/hil",
  languages: languageAlternates("/"),
  locale: "hil_PH",
});

export default function HomeHil() {
  if (!hilEnabled()) notFound();
  return <HomePage lang="hil" />;
}

import SupportPage from "@/components/pages/SupportPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("en", "support.title"),
  description: t("en", "support.description"),
  path: "/support",
  languages: languageAlternates("/support"),
});

export default function Support() {
  return <SupportPage lang="en" />;
}

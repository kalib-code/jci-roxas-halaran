import JoinPage from "@/components/pages/JoinPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("en", "join.title"),
  description: t("en", "join.description"),
  path: "/join",
  languages: languageAlternates("/join"),
});

export default function Join() {
  return <JoinPage lang="en" />;
}

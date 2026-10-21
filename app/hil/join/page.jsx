import { notFound } from "next/navigation";
import JoinPage from "@/components/pages/JoinPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { hilEnabled, languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("hil", "join.title"),
  description: t("hil", "join.description"),
  path: "/hil/join",
  languages: languageAlternates("/join"),
  locale: "hil_PH",
});

export default function JoinHil() {
  if (!hilEnabled()) notFound();
  return <JoinPage lang="hil" />;
}

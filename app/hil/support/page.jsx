import { notFound } from "next/navigation";
import SupportPage from "@/components/pages/SupportPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { hilEnabled, languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("hil", "support.title"),
  description: t("hil", "support.description"),
  path: "/hil/support",
  languages: languageAlternates("/support"),
  locale: "hil_PH",
});

export default function SupportHil() {
  if (!hilEnabled()) notFound();
  return <SupportPage lang="hil" />;
}

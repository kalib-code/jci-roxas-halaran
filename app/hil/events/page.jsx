import { notFound } from "next/navigation";
import EventsPage from "@/components/pages/EventsPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { hilEnabled, languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("hil", "events.title"),
  description: t("hil", "events.description"),
  path: "/hil/events",
  languages: languageAlternates("/events"),
  locale: "hil_PH",
});

export default function EventsHil() {
  if (!hilEnabled()) notFound();
  return <EventsPage lang="hil" />;
}

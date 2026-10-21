import EventsPage from "@/components/pages/EventsPage.jsx";
import { pageMetadata } from "@/lib/seo.js";
import { languageAlternates, t } from "@/lib/i18n.js";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: t("en", "events.title"),
  description: t("en", "events.description"),
  path: "/events",
  languages: languageAlternates("/events"),
});

export default function Events() {
  return <EventsPage lang="en" />;
}

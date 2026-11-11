import { Link } from "react-router";

import { useI18n } from "@/lib/i18n/context";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const LINKS = [
  ["/", "notFound.back"],
  ["/calendar", "nav.calendar"],
  ["/drivers", "nav.drivers"],
  ["/standings", "nav.standings"],
] as const;

export function NotFoundPage() {
  const { t } = useI18n();
  useDocumentTitle(t("notFound.title"));
  return (
    <section aria-labelledby="not-found-title" className="py-16">
      <h1 id="not-found-title" className="text-2xl font-bold">
        {t("notFound.title")}
      </h1>
      <p className="mt-2 text-muted">{t("notFound.body")}</p>
      <ul className="mt-6 flex flex-wrap gap-3">
        {LINKS.map(([to, key]) => (
          <li key={to}>
            <Link
              to={to}
              className="inline-block rounded-lg bg-panel px-4 py-2 font-semibold hover:bg-raised"
            >
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

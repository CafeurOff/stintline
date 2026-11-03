import { Link } from "react-router";

import { useI18n } from "@/lib/i18n/context";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="not-found-title" className="py-16">
      <h1 id="not-found-title" className="text-2xl font-bold">
        {t("notFound.title")}
      </h1>
      <Link to="/" className="mt-2 inline-block text-mark-text underline underline-offset-4">
        {t("notFound.back")}
      </Link>
    </section>
  );
}

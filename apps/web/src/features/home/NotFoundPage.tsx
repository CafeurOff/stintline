import type { CSSProperties } from "react";
import { Link } from "react-router";

import { pillGlass, pillPrimary } from "@/components/glass/Glass";
import { Trails } from "@/components/glass/Trails";
import { useI18n } from "@/lib/i18n/context";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

const LINKS = [
  ["/", "notFound.back"],
  ["/calendar", "nav.calendar"],
  ["/drivers", "nav.drivers"],
  ["/standings", "nav.standings"],
] as const;

/** A wrong turn: a big hollow 404 off the racing line, and the ways back to the track. */
export function NotFoundPage() {
  const { t } = useI18n();
  useDocumentTitle(t("notFound.title"));
  return (
    <section
      aria-labelledby="not-found-title"
      className="glass glow @container relative flex min-h-[60vh] flex-col justify-end overflow-hidden rounded-[24px] p-6 sm:p-10"
      style={
        { "--glow": "var(--color-mark)", "--glow-x": "100%", "--glow-y": "0%" } as CSSProperties
      }
    >
      <Trails colour="var(--color-mark)" />
      <span aria-hidden="true" className="watermark num absolute top-6 right-6 text-[30cqw]">
        404
      </span>
      <div className="relative">
        <h1 id="not-found-title" className="display text-4xl sm:text-6xl">
          {t("notFound.title")}
        </h1>
        <p className="mt-3 max-w-xl text-muted">{t("notFound.body")}</p>
        <ul className="mt-6 flex flex-wrap gap-3">
          {LINKS.map(([to, key], index) => (
            <li key={to}>
              <Link to={to} className={index === 0 ? pillPrimary : pillGlass}>
                {t(key)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

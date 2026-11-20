import { Database, FileText, Heart, Lock } from "lucide-react";
import { Link } from "react-router";

import { Panel } from "@/components/dash/Panel";
import { PageHeader } from "@/components/hub/PageHeader";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/en";

interface Credit {
  name: string;
  url: string;
  /** What we take from it. */
  use: MessageKey;
  /** Licence or terms, when they need saying. */
  terms?: MessageKey;
}

const DATA: readonly Credit[] = [
  { name: "OpenF1", url: "https://openf1.org", use: "about.data.openf1" },
  { name: "Jolpica F1", url: "https://github.com/jolpica/jolpica-f1", use: "about.data.jolpica" },
  { name: "FIA", url: "https://www.fia.com/documents", use: "about.data.fia" },
  {
    name: "Open-Meteo",
    url: "https://open-meteo.com",
    use: "about.data.weather",
    terms: "about.terms.ccby",
  },
  {
    name: "Wikipedia · Wikimedia Commons",
    url: "https://commons.wikimedia.org",
    use: "about.data.wikipedia",
    terms: "about.terms.wikipedia",
  },
  {
    name: "Formula 1 media",
    url: "https://www.formula1.com",
    use: "about.data.media",
    terms: "about.terms.media",
  },
  {
    name: "RSS",
    url: "https://www.rssboard.org",
    use: "about.data.news",
    terms: "about.terms.news",
  },
];

const SOFTWARE: readonly Credit[] = [
  {
    name: "Archivo",
    url: "https://fonts.google.com/specimen/Archivo",
    use: "about.soft.font",
    terms: "about.terms.ofl",
  },
  {
    name: "flag-icons",
    url: "https://flagicons.lipis.dev",
    use: "about.soft.flags",
    terms: "about.terms.mit",
  },
  { name: "Lucide", url: "https://lucide.dev", use: "about.soft.icons", terms: "about.terms.isc" },
  {
    name: "visx",
    url: "https://airbnb.io/visx",
    use: "about.soft.charts",
    terms: "about.terms.mit",
  },
  { name: "three.js", url: "https://threejs.org", use: "about.soft.3d", terms: "about.terms.mit" },
  {
    name: "PDF.js",
    url: "https://mozilla.github.io/pdf.js",
    use: "about.soft.pdf",
    terms: "about.terms.apache",
  },
  { name: "React · Django", url: "https://react.dev", use: "about.soft.stack" },
];

function CreditList({ items }: { items: readonly Credit[] }) {
  const { t } = useI18n();
  return (
    <ul className="flex flex-col divide-y divide-line">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="w-fit font-bold underline decoration-line-strong underline-offset-4 hover:decoration-current"
          >
            {item.name}
          </a>
          <span className="text-sm text-muted">{t(item.use)}</span>
          {item.terms && <span className="text-xs text-muted">{t(item.terms)}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Who made this, where the data and pictures come from, and what we keep about readers. */
export function AboutPage() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("about.title")}>{t("about.intro")}</PageHeader>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel
          title={t("about.dataTitle")}
          icon={<Database />}
          className="xl:self-start"
          bodyClassName="p-5"
        >
          <CreditList items={DATA} />
        </Panel>
        <div className="flex flex-col gap-5">
          <Panel title={t("about.privacyTitle")} icon={<Lock />} bodyClassName="gap-3 p-5">
            <p>{t("about.privacy.cookies")}</p>
            <p className="text-sm text-muted">{t("about.privacy.storage")}</p>
            <p className="text-sm text-muted">{t("about.privacy.visits")}</p>
          </Panel>
          <Panel title={t("about.unofficialTitle")} icon={<FileText />} bodyClassName="gap-3 p-5">
            <p>{t("about.unofficial")}</p>
            <p className="text-sm text-muted">
              {t("about.model")}{" "}
              <Link to="/model" className="font-semibold underline underline-offset-4">
                {t("nav.model")}
              </Link>
            </p>
          </Panel>
          <Panel title={t("about.softwareTitle")} icon={<Heart />} bodyClassName="p-5">
            <CreditList items={SOFTWARE} />
            <a
              href="https://github.com/CafeurOff/stintline"
              target="_blank"
              rel="noreferrer"
              className="mt-4 w-fit text-sm font-semibold underline underline-offset-4"
            >
              {t("about.source")}
            </a>
          </Panel>
        </div>
      </div>
    </div>
  );
}

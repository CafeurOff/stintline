import { PageHeader } from "@/components/layout/PageHeader";
import { SeasonSelect } from "@/components/racing/SeasonSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSeasonParam } from "@/features/analysis/season";
import { useI18n } from "@/lib/i18n/context";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { IncidentsTab } from "./IncidentsTab";
import { PowerUnitsTab } from "./PowerUnitsTab";
import { UpgradesTab } from "./UpgradesTab";

type Tab = "upgrades" | "power-units" | "incidents";

const TABS: readonly Tab[] = ["upgrades", "power-units", "incidents"];

export function TechnicalPage() {
  const { t } = useI18n();
  const [year, setYear] = useSeasonParam();
  const [params, update] = useSearchParamsState();
  const tab = TABS.find((x) => x === params.get("tab")) ?? "upgrades";
  return (
    <div className="flex flex-col">
      <PageHeader
        terms={["powerUnit", "penaltyPoints"]}
        title={t("tech.title")}
        actions={
          <>
            <SegmentedControl
              legend={t("tech.tab")}
              hideLegend
              options={TABS.map((value) => ({ value, label: t(`tech.tab.${value}`) }))}
              value={tab}
              onChange={(value) => {
                update({ tab: value === "upgrades" ? null : value, team: null, round: null });
              }}
            />
            <SeasonSelect
              value={year}
              onChange={(value) => {
                update({ team: null, round: null });
                setYear(value);
              }}
            />
          </>
        }
      >
        {t("tech.intro")}
      </PageHeader>
      {year === null ? (
        <Skeleton className="h-[60vh]" />
      ) : tab === "upgrades" ? (
        <UpgradesTab year={year} />
      ) : tab === "power-units" ? (
        <PowerUnitsTab year={year} />
      ) : (
        <IncidentsTab year={year} />
      )}
    </div>
  );
}

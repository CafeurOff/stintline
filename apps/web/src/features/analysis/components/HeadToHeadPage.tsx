import { PageHeader } from "@/components/layout/PageHeader";
import { SeasonSelect } from "@/components/racing/SeasonSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useI18n } from "@/lib/i18n/context";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { useSeasonParam } from "../season";
import { AnalysisTabs } from "./common";
import { Drivers } from "./DriverDuel";
import { Teammates } from "./TeammateDuels";

export function HeadToHeadPage() {
  const { t } = useI18n();
  const [year, setYear] = useSeasonParam();
  const [params, update] = useSearchParamsState();
  const mode = params.get("mode") === "drivers" ? "drivers" : "teams";

  return (
    <div className="flex flex-col">
      <PageHeader
        terms={["cleanLap", "fuelCorrected", "median"]}
        title={t("h2h.title")}
        actions={
          <>
            <SegmentedControl
              legend={t("h2h.mode")}
              hideLegend
              options={[
                { value: "teams", label: t("h2h.teammates") },
                { value: "drivers", label: t("h2h.drivers") },
              ]}
              value={mode}
              onChange={(value) => {
                update({ mode: value === "teams" ? null : value });
              }}
            />
            <SeasonSelect
              value={year}
              onChange={(value) => {
                update({ a: null, b: null });
                setYear(value);
              }}
            />
          </>
        }
      >
        {t("h2h.intro")}
      </PageHeader>
      <AnalysisTabs />
      {year === null ? (
        <Skeleton className="h-[60vh]" />
      ) : mode === "teams" ? (
        <Teammates year={year} />
      ) : (
        <Drivers year={year} />
      )}
    </div>
  );
}

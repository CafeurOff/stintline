import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useI18n } from "@/lib/i18n/context";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { DirectionA } from "./DirectionA";
import { DirectionB } from "./DirectionB";
import { DirectionC } from "./DirectionC";
import { useHomeBundle } from "./data";

const DIRECTIONS = ["a", "b", "c"] as const;
type Direction = (typeof DIRECTIONS)[number];

function isDirection(value: string | null): value is Direction {
  return DIRECTIONS.some((d) => d === value);
}

/**
 * Development only: three directions for the home page, drawn from the real API, so the
 * maintainer can pick one before the site is restyled (`/dev/directions?d=a|b|c`).
 */
export function DirectionsPage() {
  const { t } = useI18n();
  const [params, update] = useSearchParamsState();
  const raw = params.get("d");
  const direction: Direction = isDirection(raw) ? raw : "a";
  const data = useHomeBundle();
  useDocumentTitle(t("dev.directions.title"));

  return (
    <div>
      <div className="sticky top-0 z-50 flex items-center justify-center border-b border-line bg-panel px-4 py-2">
        <SegmentedControl
          legend={t("dev.directions.pick")}
          hideLegend
          value={direction}
          onChange={(d) => {
            update({ d });
          }}
          options={DIRECTIONS.map((d) => ({ value: d, label: t(`dev.directions.${d}`) }))}
        />
      </div>
      {data.home.isError ? (
        <ErrorState error={data.home.error} onRetry={() => void data.home.refetch()} />
      ) : !data.home.data ? (
        <Skeleton className="h-[80vh]" />
      ) : direction === "a" ? (
        <DirectionA data={data} />
      ) : direction === "b" ? (
        <DirectionB data={data} />
      ) : (
        <DirectionC data={data} />
      )}
    </div>
  );
}

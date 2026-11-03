import type { Schema } from "@stintline/api-types";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";

import { driverCode, driverName, type Entry } from "../entries";
import { neighbours } from "../stops";

type PitExit = Schema<"PitExitResult">;

interface StopPanelProps {
  entry: Entry;
  canStop: boolean;
  maxLap: number;
  submitted: boolean;
  result: PitExit | undefined;
  isError: boolean;
  error: unknown;
  byCar: Map<number, Entry>;
  onSimulate: () => void;
  onClear: () => void;
  onRetry: () => void;
}

export function StopPanel(props: StopPanelProps) {
  const { t, f } = useI18n();
  const { entry, result } = props;

  if (!props.canStop) {
    return (
      <p className="text-muted">
        {t("stop.cannot", { name: driverName(entry), max: props.maxLap })}
      </p>
    );
  }
  if (!props.submitted) {
    return <Button onClick={props.onSimulate}>{t("stop.go")}</Button>;
  }
  if (props.isError) return <ErrorState error={props.error} onRetry={props.onRetry} />;
  if (!result) return <Skeleton className="h-40" />;

  const { ahead, behind, close } = neighbours(result, props.byCar);
  const code = driverCode(entry);
  const loss = f.seconds(result.pit_loss_s, 0);
  const sentence =
    ahead && behind
      ? t("stop.between", {
          code,
          loss,
          ahead: driverCode(ahead.entry),
          aheadGap: f.seconds(ahead.gap),
          behind: driverCode(behind.entry),
          behindGap: f.seconds(behind.gap),
        })
      : behind
        ? t("stop.front", {
            code,
            loss,
            behind: driverCode(behind.entry),
            behindGap: f.seconds(behind.gap),
          })
        : t("stop.back", {
            code,
            loss,
            ahead: ahead ? driverCode(ahead.entry) : "",
            aheadGap: ahead ? f.seconds(ahead.gap) : "",
          });
  const position = result.most_likely_position;
  const rows = [
    ahead && { entry: ahead.entry, position: position - 1, gap: f.delta(-ahead.gap) },
    { entry, position, gap: "", me: true },
    behind && { entry: behind.entry, position: position + 1, gap: f.delta(behind.gap) },
  ].filter((row): row is { entry: Entry; position: number; gap: string; me?: boolean } =>
    Boolean(row),
  );

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="tabular text-4xl leading-none font-bold">
        {f.ordinal(position)}{" "}
        <span className="text-lg font-normal text-muted">{t("stop.rejoin")}</span>
      </p>
      <p>{sentence}</p>
      <ol className="flex flex-col gap-1">
        {rows.map((row) => (
          <li
            key={row.entry.car_number}
            className={`tabular grid grid-cols-[2.5rem_0.75rem_1fr_auto] items-center gap-2 rounded-md px-2 py-1 ${row.me ? "bg-mark/15 font-bold" : ""}`}
          >
            <span>{f.ordinal(row.position)}</span>
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: teamColour(row.entry.team_colour) }}
            />
            <span className="truncate">{driverName(row.entry)}</span>
            <span className="text-muted">{row.gap}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted">
        {close.length > 0
          ? t("stop.close", {
              names: close.map(driverCode).join(", "),
              sigma: f.seconds(result.sigma_s, 0),
            })
          : t("stop.safe", { sigma: f.seconds(result.sigma_s, 0) })}
      </p>
      <Button variant="quiet" className="self-start" onClick={props.onClear}>
        {t("common.clear")}
      </Button>
    </div>
  );
}

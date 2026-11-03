import type { Schema } from "@stintline/api-types";

import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { useI18n } from "@/lib/i18n/context";

import { driverCode, driverName, type Entry } from "../entries";
import { REACTIONS, UNDERCUT_COMPOUNDS, type UndercutChoice } from "../undercut";

interface UndercutPanelProps {
  attacker: Entry;
  /** Cars that can be attacked: those ahead on track, nearest first. */
  targets: Entry[];
  choice: UndercutChoice | null;
  canStop: boolean;
  maxLap: number;
  submitted: boolean;
  result: Schema<"UndercutResult"> | undefined;
  isError: boolean;
  error: unknown;
  onChange: (choice: UndercutChoice) => void;
  onSimulate: () => void;
  onClear: () => void;
  onRetry: () => void;
}

export function UndercutPanel(props: UndercutPanelProps) {
  const { t, f } = useI18n();
  const { attacker, choice, result } = props;
  const defender = props.targets.find((e) => e.car_number === choice?.defender);

  if (!choice || !defender) {
    return <p className="text-muted">{t("undercut.leader", { name: driverName(attacker) })}</p>;
  }
  if (!props.canStop) {
    return (
      <p className="text-muted">
        {t("stop.cannot", { name: driverName(attacker), max: props.maxLap })}
      </p>
    );
  }

  const a = driverCode(attacker);
  const d = driverCode(defender);
  const update = (patch: Partial<UndercutChoice>) => {
    props.onChange({ ...choice, ...patch });
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl leading-tight font-bold">
        {t("undercut.question", { attacker: driverName(attacker), defender: driverName(defender) })}
      </h2>
      <Select
        label={t("undercut.defender")}
        value={choice.defender}
        onChange={(event) => {
          update({ defender: Number(event.target.value) });
        }}
      >
        {props.targets.map((entry) => (
          <option key={entry.car_number} value={entry.car_number}>
            {driverName(entry)}
          </option>
        ))}
      </Select>
      <SegmentedControl
        legend={t("undercut.tyres", { code: a })}
        options={UNDERCUT_COMPOUNDS.map((value) => ({ value, label: t(`compound.${value}`) }))}
        value={choice.compound}
        onChange={(compound) => {
          update({ compound });
        }}
      />
      <SegmentedControl
        legend={t("undercut.reaction", { code: d })}
        options={REACTIONS.map((value) => ({
          value,
          label: value,
        }))}
        value={choice.reaction}
        onChange={(reaction) => {
          update({ reaction });
        }}
      />
      <p className="-mt-2 text-sm text-muted">
        {t(choice.reaction === "1" ? "undercut.reaction.value" : "undercut.reaction.values", {
          n: choice.reaction,
        })}
      </p>
      {!props.submitted ? (
        <Button onClick={props.onSimulate}>{t("undercut.go")}</Button>
      ) : props.isError ? (
        <ErrorState error={props.error} onRetry={props.onRetry} />
      ) : !result ? (
        <Skeleton className="h-28" />
      ) : (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p
            className={`text-2xl leading-tight font-bold ${result.attacker_ahead ? "text-gain" : "text-loss"}`}
          >
            {result.attacker_ahead
              ? t("undercut.works", { attacker: a })
              : t("undercut.fails", { attacker: a })}
          </p>
          <p>
            {t("undercut.detail", {
              attacker: a,
              defender: d,
              gap: f.seconds(Math.abs(result.gap_after_s)),
              side: result.gap_after_s > 0 ? t("undercut.side.behind") : t("undercut.side.ahead"),
              before: f.seconds(Math.abs(result.gap_before_s)),
              p: f.probability(result.p_attacker_ahead),
            })}
          </p>
          <Button variant="quiet" className="self-start" onClick={props.onClear}>
            {t("common.clear")}
          </Button>
        </div>
      )}
    </div>
  );
}

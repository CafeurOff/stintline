import type { Schema } from "@stintline/api-types";
import { ArrowLeftRight, Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { ShowAll } from "@/components/layout/Collapsible";
import { Panel } from "@/components/layout/Panel";
import { useCollapsed } from "@/components/layout/useCollapsed";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useI18n } from "@/lib/i18n/context";

import { useCircuitUndercuts } from "../api";
import { DriverChip } from "./AnalysisParts";

type Attempt = Schema<"UndercutAttempt">;
type Car = Schema<"UndercutCar">;

/** Attempts shown before "Show all": about two races' worth. */
const ATTEMPTS_SHOWN = 12;

/** Desktop column layout, shared by the header row and every attempt. */
const COLUMNS =
  "sm:grid-cols-[3.5rem_minmax(0,1.6fr)_6.5rem_minmax(0,1.3fr)_minmax(0,1fr)_8rem_5.5rem]";

function carName(car: Car, t: ReturnType<typeof useI18n>["t"]): string {
  return car.driver?.code ?? car.driver?.family_name ?? t("undercuts.car", { n: car.car_number });
}

function CarChip({ car }: { car: Car }) {
  const { t } = useI18n();
  if (!car.driver) return <span className="text-muted">{carName(car, t)}</span>;
  return <DriverChip driver={car.driver} colour={car.colour} size="size-6" compact />;
}

/** One figure: labelled in the stacked phone layout, under the header row on wider screens. */
function Cell({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-baseline gap-2 ${className}`}>
      <span className="w-28 shrink-0 text-xs text-muted sm:sr-only">{label}</span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

/** Centred bar: gain to the right, loss to the left, on a shared scale. */
function GainBar({ gain, top }: { gain: number; top: number }) {
  const width = `${String((Math.min(Math.abs(gain), top) / top) * 50)}%`;
  return (
    <span
      className="relative hidden h-1.5 w-full rounded-full bg-raised sm:block"
      aria-hidden="true"
    >
      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line-strong" />
      <span
        className={`absolute inset-y-0 rounded-full ${gain >= 0 ? "left-1/2 bg-gain" : "right-1/2 bg-loss"}`}
        style={{ width }}
      />
    </span>
  );
}

function AttemptRow({ a, top }: { a: Attempt; top: number }) {
  const { t, f } = useI18n();
  const after =
    a.gap_after_s < 0
      ? t("undercuts.gapAhead", { gap: f.seconds(-a.gap_after_s, 1) })
      : t("undercuts.gapBehind", { gap: f.seconds(a.gap_after_s, 1) });
  const simulate = `/sessions/${String(a.session_id)}?mode=undercut&car=${String(a.attacker.car_number)}&lap=${String(Math.max(a.attacker_lap - 1, 1))}`;
  return (
    <li
      className={`grid grid-cols-1 gap-1.5 px-5 py-3 text-sm sm:items-center sm:gap-3 ${COLUMNS}`}
    >
      <Cell label={t("col.season")}>
        <Link to={`/events/${String(a.event_id)}`} className="num font-bold hover:underline">
          {a.year}
        </Link>
        {a.wet && <span className="ml-1 text-xs text-t-blue">{t("dna.wet")}</span>}
      </Cell>
      <Cell label={t("undercuts.who")}>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <CarChip car={a.attacker} />
          <span className="text-xs text-muted">{t("undercuts.on")}</span>
          <CarChip car={a.defender} />
        </span>
      </Cell>
      <Cell label={t("undercuts.stops")}>
        <span className="num">{t("undercuts.laps", { a: a.attacker_lap, d: a.defender_lap })}</span>
      </Cell>
      <Cell label={t("undercuts.gaps")}>
        <span className="num">
          {t("undercuts.gapBehind", { gap: f.seconds(a.gap_before_s, 1) })} → {after}
        </span>
      </Cell>
      <Cell label={t("undercuts.gain")}>
        <span className="flex items-center gap-2">
          <span
            className={`num w-14 shrink-0 font-semibold ${a.gain_s >= 0 ? "text-gain" : "text-loss"}`}
          >
            {f.delta(a.gain_s, 1)}
          </span>
          <GainBar gain={a.gain_s} top={top} />
        </span>
      </Cell>
      <Cell label={t("undercuts.result")}>
        <span
          className={`inline-flex items-center gap-1 font-semibold ${a.success ? "text-gain" : "text-loss"}`}
        >
          {a.success ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <X aria-hidden="true" className="size-4" />
          )}
          {a.success ? t("undercuts.ahead") : t("undercuts.behind")}
        </span>
      </Cell>
      <div className="sm:text-right">
        <Link
          to={simulate}
          aria-label={t("undercuts.simulateLabel", {
            a: carName(a.attacker, t),
            d: carName(a.defender, t),
            year: a.year,
          })}
          className="font-semibold hover:underline"
        >
          {t("undercuts.simulate")} →
        </Link>
      </div>
    </li>
  );
}

function Body({ data }: { data: Schema<"CircuitUndercuts"> }) {
  const { t, f } = useI18n();
  const collapsed = useCollapsed(data.attempts, ATTEMPTS_SHOWN);
  if (data.attempts.length === 0) return <EmptyState title={t("undercuts.empty")} />;
  const top = Math.max(...data.attempts.map((a) => Math.abs(a.gain_s)), 1);
  return (
    <>
      <div className="flex flex-col gap-1 px-5 pb-3 text-sm">
        <p>{t("undercuts.summary", { n: data.attempts.length, ok: data.successes })}</p>
        <p className="font-semibold">
          {data.median_gain_s == null
            ? t("undercuts.tooFew", { n: data.min_attempts })
            : t("undercuts.median", { gain: f.delta(data.median_gain_s, 1) })}
        </p>
      </div>
      <div
        aria-hidden="true"
        className={`hidden gap-3 border-y border-line px-5 py-2 text-xs text-muted sm:grid ${COLUMNS}`}
      >
        <span>{t("col.season")}</span>
        <span>{t("undercuts.who")}</span>
        <span>{t("undercuts.stops")}</span>
        <span>{t("undercuts.gaps")}</span>
        <span>{t("undercuts.gain")}</span>
        <span>{t("undercuts.result")}</span>
        <span />
      </div>
      <ul
        aria-label={t("undercuts.title")}
        className="flex flex-col divide-y divide-line border-line max-sm:border-t"
      >
        {collapsed.shown.map((a) => (
          <AttemptRow
            key={`${String(a.session_id)}-${String(a.attacker.car_number)}-${String(a.attacker_lap)}`}
            a={a}
            top={top}
          />
        ))}
      </ul>
      <div className="flex flex-col gap-3 border-t border-line px-5 py-3">
        <ShowAll
          hidden={collapsed.hidden}
          open={collapsed.open}
          onToggle={() => {
            collapsed.setOpen(!collapsed.open);
          }}
        />
        <p className="text-xs text-muted">{t("undercuts.note")}</p>
      </div>
    </>
  );
}

/** Every green-flag undercut tried at a circuit, with what it gained (issue #14). */
export function CircuitUndercuts({ circuitRef }: { circuitRef: string }) {
  const { t } = useI18n();
  const query = useCircuitUndercuts(circuitRef);
  return (
    <Panel title={t("undercuts.title")} icon={<ArrowLeftRight />}>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <Skeleton className="m-5 h-48" />
      ) : (
        <Body data={query.data} />
      )}
    </Panel>
  );
}

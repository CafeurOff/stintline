import type { Schema } from "@stintline/api-types";

import { useI18n } from "@/lib/i18n/context";

type Period = Schema<"FlagPeriod">;

const TONE: Record<Period["status"], string> = {
  yellow: "bg-t-yellow/50",
  safety_car: "bg-caution",
  virtual_safety_car: "bg-caution/60",
  red: "bg-loss",
};

/**
 * The session lap by lap with its flag periods (safety car, virtual safety car, red flag
 * and yellows), and the current lap. The list under the bar says the same in words.
 */
export function FlagTimeline({
  periods,
  lap,
  total,
}: {
  periods: readonly Period[];
  lap: number | null;
  total: number | null;
}) {
  const { t } = useI18n();
  const laps = total ?? lap ?? 0;
  if (laps <= 0) return null;
  const share = (n: number) => `${String(((n - 1) / laps) * 100)}%`;
  const width = (from: number, to: number) => `${String(((to - from + 1) / laps) * 100)}%`;
  const major = periods.filter((p) => p.status !== "yellow");
  const yellows = periods.length - major.length;
  return (
    <section aria-labelledby="live-timeline" className="flex flex-col gap-2">
      <h2 id="live-timeline" className="text-sm font-bold">
        {t("live.timeline")}
      </h2>
      <div aria-hidden="true" className="relative h-3 overflow-hidden rounded-full bg-raised">
        {lap != null && (
          <span
            className="absolute inset-y-0 left-0 bg-line-strong"
            style={{ width: width(1, Math.min(lap, laps)) }}
          />
        )}
        {periods.map((p) =>
          p.start_lap == null ? null : (
            <span
              key={`${p.status}-${p.start_at}`}
              className={`absolute inset-y-0 ${TONE[p.status]}`}
              style={{
                left: share(p.start_lap),
                width: width(p.start_lap, p.end_lap ?? lap ?? p.start_lap),
              }}
            />
          ),
        )}
      </div>
      <div aria-hidden="true" className="num flex justify-between text-xs text-muted">
        <span>{t("analysis.lap")} 1</span>
        <span>{laps}</span>
      </div>
      {major.length > 0 || yellows > 0 ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {major.map((p) => (
            <li key={`${p.status}-${p.start_at}`} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={`size-2.5 rounded-sm ${TONE[p.status]}`} />
              {t(`live.track.${p.status}`)}
              <span className="text-muted">
                {p.start_lap == null
                  ? ""
                  : p.end_lap == null
                    ? t("live.period.since", { from: p.start_lap })
                    : p.end_lap === p.start_lap
                      ? t("live.period.lap", { lap: p.start_lap })
                      : t("live.period.laps", { from: p.start_lap, to: p.end_lap })}
              </span>
            </li>
          ))}
          {yellows > 0 && (
            <li className="flex items-center gap-1.5 text-muted">
              <span aria-hidden="true" className={`size-2.5 rounded-sm ${TONE.yellow}`} />
              {t("live.period.yellows", { n: yellows })}
            </li>
          )}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("live.period.none")}</p>
      )}
    </section>
  );
}

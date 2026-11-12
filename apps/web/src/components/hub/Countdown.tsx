import { useI18n } from "@/lib/i18n/context";
import { timeLeft, useClock } from "@/lib/useClock";

/** Days, hours, minutes and seconds to `target`, as broadcast-style blocks. */
export function Countdown({ target, compact = false }: { target: string; compact?: boolean }) {
  const { t } = useI18n();
  const now = useClock(1000);
  const left = timeLeft(new Date(target).getTime(), now);
  const parts = [
    [left.days, t("countdown.days")],
    [left.hours, t("countdown.hours")],
    [left.minutes, t("countdown.minutes")],
    [left.seconds, t("countdown.seconds")],
  ] as const;
  return (
    <div
      role="timer"
      aria-label={t("countdown.label", {
        days: left.days,
        hours: left.hours,
        minutes: left.minutes,
      })}
      className="flex gap-2"
    >
      {parts.map(([value, unit]) => (
        <span
          key={unit}
          aria-hidden="true"
          className={`flex flex-col items-center rounded-lg bg-raised ${
            compact ? "min-w-12 px-2 py-1" : "min-w-16 px-3 py-2"
          }`}
        >
          <span
            className={`leading-none font-extrabold tabular-nums ${compact ? "text-xl" : "text-3xl"}`}
          >
            {String(value).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[0.65rem] font-semibold tracking-wide text-muted uppercase">
            {unit}
          </span>
        </span>
      ))}
    </div>
  );
}

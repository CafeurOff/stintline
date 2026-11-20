import { useI18n } from "@/lib/i18n/context";
import { timeLeft, useClock } from "@/lib/useClock";

/** Days, hours, minutes and seconds to `target`, as tall timing-board figures. */
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
      className={`flex ${compact ? "gap-3" : "gap-6 sm:gap-8"}`}
    >
      {parts.map(([value, unit]) => (
        <span key={unit} aria-hidden="true" className="flex flex-col">
          <span
            key={value}
            className={`num timing animate-[tick_0.45s_ease-out] leading-[0.85] ${
              compact ? "text-4xl" : "text-7xl sm:text-8xl"
            }`}
          >
            {String(value).padStart(2, "0")}
          </span>
          <span className="mt-1 text-xs font-semibold text-muted">{unit}</span>
        </span>
      ))}
    </div>
  );
}

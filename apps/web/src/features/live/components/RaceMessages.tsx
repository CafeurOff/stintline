import type { Schema } from "@stintline/api-types";

import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { RadioPlayButton, RadioProgress } from "@/features/radio/components/RadioPlayButton";
import { useRadioPlayer } from "@/features/radio/useRadioPlayer";

import type { LiveSnapshot } from "../buffer";

function clock(value: string | null | undefined, locale: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function Radio({ snapshot }: { snapshot: LiveSnapshot }) {
  const { t, locale } = useI18n();
  const player = useRadioPlayer();
  const byNumber = new Map(snapshot.cars.map((c) => [c.number, c]));
  if (snapshot.team_radio.length === 0) return null;
  return (
    <section aria-labelledby="live-radio" className="flex flex-col gap-3">
      <h2 id="live-radio" className="text-lg font-bold">
        {t("live.radio")}
      </h2>
      <ul className="flex flex-col">
        {snapshot.team_radio.slice(0, 8).map((radio) => {
          const car = byNumber.get(radio.number);
          const code = car?.code ?? String(radio.number);
          const colour = teamColour(car?.colour);
          return (
            <li key={radio.url} className="flex gap-3 border-b border-line py-2.5 last:border-b-0">
              <RadioPlayButton
                url={radio.url}
                label={t("live.radioOf", { code, time: clock(radio.at, locale) })}
                pauseLabel={t("radio.pause", { code })}
                playback={player}
                onToggle={player.toggle}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden="true"
                    className="h-3 w-1 rounded-full"
                    style={{ backgroundColor: colour }}
                  />
                  <span className="font-semibold">{code}</span>
                  <span className="text-muted tabular-nums">{clock(radio.at, locale)}</span>
                </span>
                {radio.transcript ? (
                  <q lang="en" className="text-sm">
                    {radio.transcript}
                  </q>
                ) : radio.transcript === null ? (
                  <p className="text-xs text-muted italic">{t("radio.pending")}</p>
                ) : null}
                {player.url === radio.url && <RadioProgress playback={player} colour={colour} />}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">{t("live.radioNote")}</p>
    </section>
  );
}

export function RaceControl({ snapshot }: { snapshot: LiveSnapshot }) {
  const { t, locale } = useI18n();
  if (snapshot.race_control.length === 0) return null;
  return (
    <section aria-labelledby="live-rc" className="flex flex-col gap-2">
      <h2 id="live-rc" className="text-lg font-bold">
        {t("live.raceControl")}
      </h2>
      <ol className="flex flex-col gap-2 text-sm">
        {snapshot.race_control.slice(0, 10).map((message, index) => (
          <li
            key={`${message.at ?? ""}-${String(index)}`}
            className="flex flex-col gap-1 border-b border-line pb-2"
          >
            <span className="flex flex-wrap items-center gap-1.5 text-xs">
              {message.lap != null && (
                <span className="num rounded bg-raised px-1.5 py-0.5 font-bold">
                  <span aria-hidden="true">L{message.lap}</span>
                  <span className="sr-only">
                    {t("analysis.lap")} {message.lap}
                  </span>
                </span>
              )}
              <RaceControlTag message={message} />
              <span className="text-muted tabular-nums">{clock(message.at, locale)}</span>
            </span>
            <span>{message.message}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FLAGS = {
  RED: ["bg-loss text-white", "live.rc.red"],
  YELLOW: ["bg-caution text-tyre-ink", "live.rc.yellow"],
  "DOUBLE YELLOW": ["bg-caution text-tyre-ink", "live.rc.doubleYellow"],
  GREEN: ["bg-gain text-tyre-ink", "live.rc.green"],
  CLEAR: ["bg-gain text-tyre-ink", "live.rc.green"],
  CHEQUERED: ["bg-ink text-bg", "live.rc.chequered"],
  BLUE: ["bg-t-blue text-white", "live.rc.blue"],
} as const;

/** The flag or kind of a race control message, as a coloured tag with its name. */
function RaceControlTag({ message }: { message: Schema<"RaceControl"> }) {
  const { t } = useI18n();
  const flag = message.flag.toUpperCase();
  if (flag in FLAGS) {
    const [tone, key] = FLAGS[flag as keyof typeof FLAGS];
    return <span className={`rounded px-1.5 py-0.5 font-bold ${tone}`}>{t(key)}</span>;
  }
  if (message.category === "SafetyCar") {
    return (
      <span className="rounded bg-caution px-1.5 py-0.5 font-bold text-tyre-ink">
        {t("live.rc.safetyCar")}
      </span>
    );
  }
  if (/STEWARDS|INVESTIGAT|PENALTY/i.test(message.message)) {
    return (
      <span className="rounded border border-line-strong px-1.5 py-0.5 font-bold">
        {t("live.rc.stewards")}
      </span>
    );
  }
  return null;
}

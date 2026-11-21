import { Radio } from "lucide-react";

import { PillSwitch } from "@/components/layout/Glass";
import { ShowAll } from "@/components/layout/Collapsible";
import { Panel } from "@/components/layout/Panel";
import { useCollapsed } from "@/components/layout/useCollapsed";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { driverCode, driverName, type Entry } from "@/features/race/entries";
import { useI18n } from "@/lib/i18n/context";
import { teamColour } from "@/lib/teams";
import { useSearchParamsState } from "@/lib/useSearchParam";

import { useSessionRadio } from "../api";
import { isBoxCall, isUncertain, radioOf, type TeamRadio } from "../radio";

/** Messages shown before "show all": about one screen. */
const FIRST_MESSAGES = 8;

/**
 * Team radio of a session (ADR 0029): every clip played from the official recording, with
 * what was said (automatic transcription) and the lap it was sent on. Follows the selected
 * driver, or every driver with `?radio=all`.
 */
export function RadioPanel({
  sessionId,
  byCar,
  selected,
  onSeek,
}: {
  sessionId: number;
  byCar: ReadonlyMap<number, Entry>;
  selected: number;
  /** Moves the replay to the moment of a message. */
  onSeek?: (message: TeamRadio) => void;
}) {
  const { t } = useI18n();
  const [params, update] = useSearchParamsState();
  const scope = params.get("radio") === "all" ? "all" : "driver";
  const radio = useSessionRadio(sessionId);
  const entry = byCar.get(selected);
  const messages = radioOf(radio.data ?? [], scope === "all" ? null : selected);
  const { shown, hidden, open, setOpen } = useCollapsed(messages, FIRST_MESSAGES);

  return (
    <Panel
      id="session-radio"
      title={t("radio.title")}
      icon={<Radio />}
      action={
        <PillSwitch
          label={t("radio.scope")}
          value={scope}
          options={[
            ["driver", entry ? driverCode(entry) : t("radio.driver")],
            ["all", t("radio.all")],
          ]}
          onChange={(next) => {
            update({ radio: next === "all" ? "all" : null });
          }}
        />
      }
      bodyClassName="flex flex-col gap-4 px-5 pb-5"
    >
      {radio.isError ? (
        <ErrorState error={radio.error} onRetry={() => void radio.refetch()} />
      ) : !radio.data ? (
        <Skeleton className="h-40" />
      ) : messages.length === 0 ? (
        <p className="text-muted">
          {scope === "all" || !entry
            ? t("radio.none")
            : t("radio.noneFor", { name: driverName(entry) })}
        </p>
      ) : (
        <>
          <ol className="flex flex-col divide-y divide-line">
            {shown.map((message) => (
              <RadioMessage
                key={message.url}
                message={message}
                entry={byCar.get(message.car_number)}
                onSeek={onSeek}
              />
            ))}
          </ol>
          <ShowAll
            hidden={hidden}
            open={open}
            onToggle={() => {
              setOpen(!open);
            }}
          />
        </>
      )}
      <p className="text-xs text-muted">{t("radio.note")}</p>
    </Panel>
  );
}

function clock(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
}

function RadioMessage({
  message,
  entry,
  onSeek,
}: {
  message: TeamRadio;
  entry: Entry | undefined;
  onSeek: ((message: TeamRadio) => void) | undefined;
}) {
  const { t, locale } = useI18n();
  const code = entry ? driverCode(entry) : `#${String(message.car_number)}`;
  const lap = message.lap === null ? null : t("radio.lap", { lap: message.lap });
  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          aria-hidden="true"
          className="h-4 w-1 rounded-full"
          style={{ backgroundColor: teamColour(entry?.team_colour) }}
        />
        <span className="font-bold">{code}</span>
        {lap &&
          (onSeek ? (
            <button
              type="button"
              onClick={() => {
                onSeek(message);
              }}
              aria-label={t("radio.seek", { code, lap: message.lap ?? 0 })}
              className="num rounded-full border border-line px-2 py-0.5 text-xs font-semibold hover:border-ink"
            >
              {lap}
            </button>
          ) : (
            <span className="num text-xs text-muted">{lap}</span>
          ))}
        {isBoxCall(message.transcript) && (
          <span className="rounded-full bg-mark px-2 py-0.5 text-xs font-bold text-white">
            {t("radio.box")}
          </span>
        )}
      </div>
      <Transcript message={message} />
      {/* The transcript above is the text alternative: a caption track would repeat it. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- see above */}
      <audio
        controls
        preload="none"
        src={message.url}
        aria-label={t("radio.play", { code, time: clock(message.recorded_at, locale) })}
        className="h-8 w-full"
      />
    </li>
  );
}

function Transcript({ message }: { message: TeamRadio }) {
  const { t } = useI18n();
  if (message.transcript === null) {
    return <p className="text-sm text-muted italic">{t("radio.pending")}</p>;
  }
  if (message.transcript === "") {
    return <p className="text-sm text-muted italic">{t("radio.silent")}</p>;
  }
  return (
    <blockquote className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <q lang="en">{message.transcript}</q>
      {isUncertain(message) && <span className="text-xs text-muted">{t("radio.uncertain")}</span>}
    </blockquote>
  );
}

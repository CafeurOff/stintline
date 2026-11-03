import { useNavigate } from "react-router";

import { eventName } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";

import { useRaces } from "./useRaces";

/** Header race picker. Changing race keeps the current view (race or tyres). */
export function RaceSelect({ sessionId, view }: { sessionId: number; view: string }) {
  const { t, locale } = useI18n();
  const { races } = useRaces();
  const navigate = useNavigate();
  if (races.length === 0) return null;

  return (
    <>
      <label htmlFor="race-select" className="sr-only">
        {t("header.race")}
      </label>
      <select
        id="race-select"
        value={sessionId}
        onChange={(event) => {
          void navigate(`/sessions/${event.target.value}${view}`);
        }}
        className="[field-sizing:content] max-w-[60vw] cursor-pointer truncate rounded-md bg-transparent py-1 font-bold text-ink"
      >
        {[...new Set(races.map((race) => race.year))].map((year) => (
          <optgroup key={year} label={String(year)} className="bg-panel">
            {races
              .filter((race) => race.year === year)
              .map((race) => (
                <option key={race.sessionId} value={race.sessionId} className="bg-panel">
                  {eventName(race.eventName, locale)} {race.year}
                  {race.kind === "SPRINT" ? " · Sprint" : ""}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </>
  );
}

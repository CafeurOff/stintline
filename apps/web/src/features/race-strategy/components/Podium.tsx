import { CarImage } from "@/components/racing/CarImage";
import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { teamColour } from "@/lib/teams";

import { driverName, type Entry } from "../entries";

const STEP_LABEL = ["Winner", "Second", "Third"];

/** Top three finishers with portrait and car (official media or original illustrations). */
export function Podium({ entries }: { entries: readonly Entry[] }) {
  const podium = entries
    .filter((entry) => entry.finish_position != null && entry.finish_position <= 3)
    .sort((a, b) => (a.finish_position ?? 0) - (b.finish_position ?? 0));
  if (podium.length === 0) return null;

  return (
    <section aria-label="Podium">
      <ol className="grid gap-3 sm:grid-cols-3">
        {podium.map((entry, index) => {
          const colour = teamColour(entry.team_colour);
          return (
            <li
              key={entry.car_number}
              className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-soft"
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-1"
                style={{ backgroundColor: colour }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-10 -bottom-12 size-40 rounded-full opacity-20 blur-2xl"
                style={{ backgroundColor: colour }}
              />
              <div className="flex items-center gap-3">
                <DriverAvatar
                  carNumber={entry.car_number}
                  name={driverName(entry)}
                  colour={entry.team_colour}
                  imageUrl={entry.media?.driver_image_url}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wider text-text-muted uppercase">
                    P{entry.finish_position} · {STEP_LABEL[index]}
                  </p>
                  <p className="truncate font-semibold">{driverName(entry)}</p>
                  <p className="truncate text-sm text-text-muted">
                    {entry.team_display_name ?? entry.team.name}
                  </p>
                </div>
              </div>
              <div className="relative mt-3 flex justify-end">
                <CarImage
                  teamName={entry.team_display_name ?? entry.team.name}
                  colour={entry.team_colour}
                  imageUrl={entry.media?.car_image_url}
                  className="h-14"
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

import { CarImage } from "@/components/racing/CarImage";
import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { driverName, type Entry } from "@/features/race-strategy/entries";
import { teamColour } from "@/lib/teams";

/** Driver identity card with portrait and car, used at the top of each simulator. */
export function DriverChip({ entry, caption }: { entry: Entry; caption: string }) {
  const team = entry.team_display_name ?? entry.team.name;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-panel p-3 pl-4">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: teamColour(entry.team_colour) }}
      />
      <div className="flex items-center gap-3">
        <DriverAvatar
          carNumber={entry.car_number}
          name={driverName(entry)}
          colour={entry.team_colour}
          imageUrl={entry.media?.driver_image_url}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wider text-text-muted uppercase">
            {caption}
          </p>
          <p className="truncate font-semibold">{driverName(entry)}</p>
          <p className="truncate text-xs text-text-muted">{team}</p>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <CarImage
          teamName={team}
          colour={entry.team_colour}
          imageUrl={entry.media?.car_image_url}
          className="h-10"
        />
      </div>
    </div>
  );
}

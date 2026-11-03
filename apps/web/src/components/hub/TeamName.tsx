import { Link } from "react-router";

import { teamColour } from "@/lib/teams";

interface TeamNameProps {
  team: { ref: string; name: string };
  colour?: string | null | undefined;
  link?: boolean;
}

/** Team name with its colour as a small bar when known (no logos). */
export function TeamName({ team, colour, link = true }: TeamNameProps) {
  const swatch =
    colour == null ? null : (
      <span
        aria-hidden="true"
        className="inline-block h-3.5 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: teamColour(colour) }}
      />
    );
  return link ? (
    <Link to={`/teams/${team.ref}`} className="inline-flex items-center gap-2 hover:underline">
      {swatch}
      {team.name}
    </Link>
  ) : (
    <span className="inline-flex items-center gap-2">
      {swatch}
      {team.name}
    </span>
  );
}

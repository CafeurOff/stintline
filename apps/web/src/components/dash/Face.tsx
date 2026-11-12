import { type CSSProperties, useState } from "react";

import { inkOn, teamColour, teamTint } from "@/lib/teams";

/**
 * Driver photo (official or Wikipedia URL, ADR 0006/0009), else the code on the team colour.
 * Decorative: the name is always written next to it.
 */
export function Face({
  url,
  label,
  colour,
  className,
  style,
}: {
  url: string | null | undefined;
  label: string;
  colour: string | null | undefined;
  className: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const fill = teamColour(colour);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
        }}
        className={`object-cover object-top ${className}`}
        style={style ?? { backgroundColor: teamTint(colour, 35) }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center font-bold ${className}`}
      style={{ backgroundColor: fill, color: inkOn(fill) }}
    >
      {label}
    </span>
  );
}

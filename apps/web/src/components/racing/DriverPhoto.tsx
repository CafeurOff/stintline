import { useState } from "react";

import { inkOn, teamColour } from "@/lib/teams";

interface DriverPhotoProps {
  imageUrl: string | null | undefined;
  /** Fallback when there is no photo: the car number, code or initials. */
  label: string | number;
  colour: string | null | undefined;
  className?: string;
}

/**
 * Rectangular driver photo for cards and profile headers, decorative (the name is always
 * written next to it). Falls back to a large label in the team colour.
 */
export function DriverPhoto({ imageUrl, label, colour, className = "" }: DriverPhotoProps) {
  const [failed, setFailed] = useState(false);
  const background = teamColour(colour);
  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
        }}
        className={`object-cover object-top ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center text-4xl font-bold ${className}`}
      style={{ backgroundColor: background, color: inkOn(background) }}
    >
      {label}
    </span>
  );
}

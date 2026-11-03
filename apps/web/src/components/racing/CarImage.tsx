import { useState } from "react";

import { teamColour } from "@/lib/teams";

interface CarImageProps {
  teamName: string;
  colour: string | null | undefined;
  imageUrl?: string | null | undefined;
  className?: string;
}

/**
 * Official car render when available (ADR 0006), else an original side-view silhouette in
 * the team colour. A render that fails to load also falls back to the silhouette.
 */
export function CarImage({ teamName, colour, imageUrl, className = "h-16" }: CarImageProps) {
  const [failed, setFailed] = useState(false);
  const label = `${teamName} car`;

  if (imageUrl && !failed) {
    return (
      <img
        src={imageUrl}
        alt={label}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
        }}
        className={`w-auto object-contain ${className}`}
      />
    );
  }
  return <CarSilhouette label={label} colour={teamColour(colour)} className={className} />;
}

function CarSilhouette({
  label,
  colour,
  className,
}: {
  label: string;
  colour: string;
  className: string;
}) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 240 64"
      className={`w-auto ${className}`}
      fill="none"
    >
      {/* Original, generic open-wheel profile: rear wing, engine cover, cockpit, nose. */}
      <path
        d="M14 22h22v6H24l4 10h34l14-12h30l10-8h14l8 10 38 4 28 6c8 2 12 6 12 10v4H22L12 38z"
        fill={colour}
      />
      <path d="M118 18h12l4 8h-18z" fill="var(--color-ink)" opacity="0.65" />
      <path d="M204 44h28v4h-28z" fill={colour} opacity="0.8" />
      <circle cx="60" cy="46" r="13" fill="var(--color-ink)" />
      <circle cx="60" cy="46" r="6" fill="var(--color-tyre-unknown)" />
      <circle cx="186" cy="46" r="12" fill="var(--color-ink)" />
      <circle cx="186" cy="46" r="5.5" fill="var(--color-tyre-unknown)" />
    </svg>
  );
}

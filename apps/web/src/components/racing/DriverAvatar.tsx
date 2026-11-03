import { useState } from "react";

import { inkOn, teamColour } from "@/lib/teams";

interface DriverAvatarProps {
  /** Shown when there is no photo: the car number, or the driver's code or initials. */
  label: string | number;
  name: string;
  colour: string | null | undefined;
  imageUrl?: string | null | undefined;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Decorative avatars (the name is written next to them) are hidden from screen readers. */
  decorative?: boolean;
}

const SIZE = {
  xs: "size-6 text-[0.6rem]",
  sm: "size-8 text-xs",
  md: "size-12 text-sm",
  lg: "size-20 text-xl",
  xl: "size-32 text-3xl",
} as const;

/**
 * Driver photo when the API provides one: the official portrait (ADR 0006) or a freely
 * licensed Wikipedia image (ADR 0009). Otherwise, or when the image fails to load, an
 * original avatar in the team colour with the number, code or initials.
 */
export function DriverAvatar({
  label,
  name,
  colour,
  imageUrl,
  size = "md",
  decorative = false,
}: DriverAvatarProps) {
  const [failed, setFailed] = useState(false);
  const background = teamColour(colour);
  const showImage = Boolean(imageUrl) && !failed;

  return (
    <span
      aria-hidden={decorative || undefined}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ring-2 ${SIZE[size]}`}
      style={{
        backgroundColor: background,
        color: inkOn(background),
        ["--tw-ring-color" as string]: background,
      }}
    >
      {showImage ? (
        <img
          src={imageUrl ?? undefined}
          alt={decorative ? "" : name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            setFailed(true);
          }}
          className="size-full bg-raised object-cover object-top"
        />
      ) : (
        <span role={decorative ? undefined : "img"} aria-label={decorative ? undefined : name}>
          <span aria-hidden="true" className="tabular">
            {label}
          </span>
        </span>
      )}
    </span>
  );
}

import { useState } from "react";

import { inkOn, teamColour } from "@/lib/teams";

interface DriverAvatarProps {
  carNumber: number;
  name: string;
  colour: string | null | undefined;
  imageUrl?: string | null | undefined;
  size?: "sm" | "md" | "lg";
}

const SIZE = { sm: "size-8 text-xs", md: "size-12 text-sm", lg: "size-20 text-xl" } as const;

/**
 * Official portrait when the API provides one (ADR 0006), else an original numbered avatar
 * in the team colour. A portrait that fails to load also falls back to the avatar.
 */
export function DriverAvatar({
  carNumber,
  name,
  colour,
  imageUrl,
  size = "md",
}: DriverAvatarProps) {
  const [failed, setFailed] = useState(false);
  const background = teamColour(colour);
  const showImage = Boolean(imageUrl) && !failed;

  return (
    <span
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
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            setFailed(true);
          }}
          className="size-full bg-raised object-cover object-top"
        />
      ) : (
        <span role="img" aria-label={name} className="tabular">
          <span aria-hidden="true">{carNumber}</span>
        </span>
      )}
    </span>
  );
}

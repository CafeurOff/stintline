import { Link } from "react-router";

import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { initials } from "@/components/racing/initials";

export interface DriverLike {
  ref: string;
  code?: string;
  given_name: string;
  family_name: string;
  portrait_url?: string | null;
}

interface DriverNameProps {
  driver: DriverLike;
  colour?: string | null | undefined;
  /** Official portrait (ADR 0006), preferred over the Wikipedia one. */
  imageUrl?: string | null | undefined;
  avatar?: "xs" | "sm" | false;
}

/** Driver photo and name, linking to the profile. */
export function DriverName({ driver, colour, imageUrl, avatar = "sm" }: DriverNameProps) {
  const name = `${driver.given_name} ${driver.family_name}`;
  return (
    <Link
      to={`/drivers/${driver.ref}`}
      className="inline-flex min-w-0 items-center gap-2 hover:underline"
    >
      {avatar && (
        <DriverAvatar
          label={driver.code ?? initials(driver.given_name, driver.family_name)}
          name={name}
          colour={colour}
          imageUrl={imageUrl ?? driver.portrait_url}
          size={avatar}
          decorative
        />
      )}
      <span className="truncate">
        <span className="hidden sm:inline">{driver.given_name} </span>
        <span className="font-semibold">{driver.family_name}</span>
      </span>
    </Link>
  );
}

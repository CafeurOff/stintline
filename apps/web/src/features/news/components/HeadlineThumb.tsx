import type { Schema } from "@stintline/api-types";
import { Newspaper } from "lucide-react";
import { type CSSProperties, useState } from "react";

import { circuitAccent } from "@/lib/accent";

/**
 * The publisher's picture (ADR 0015), only as a URL reference. Without one, the source's
 * name on a glow of its own colour, so a list of headlines stays varied.
 */
export function HeadlineThumb({
  headline,
  className,
  eager = false,
}: {
  headline: Schema<"Headline">;
  className: string;
  /** The lead headline is above the fold: load it at once. */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (headline.image_url && !failed) {
    return (
      <img
        src={headline.image_url}
        alt=""
        loading={eager ? "eager" : "lazy"}
        referrerPolicy="no-referrer"
        onError={() => {
          setFailed(true);
        }}
        className={`object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`glow flex flex-col items-center justify-center gap-1 p-1 text-muted ${className}`}
      style={{ "--glow": circuitAccent(headline.source), "--glow-x": "50%" } as CSSProperties}
    >
      <Newspaper className="size-5" />
      <span className="max-w-full truncate text-[0.6rem] font-bold tracking-wide uppercase">
        {headline.source_name}
      </span>
    </span>
  );
}

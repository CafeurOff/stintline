import { useId } from "react";

/** Seconds for the lit car to go round the outline once. */
const LAP_SECONDS = 7;

/**
 * A circuit as on a timing screen, tilted towards the viewer: dark tarmac, the racing line
 * lit in the circuit colour, and a car of light lapping it. Decorative. The lap stops under
 * reduced motion (global rule in index.css).
 */
export function TrackMap({
  path,
  colour,
  className = "",
}: {
  path: string;
  colour: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div aria-hidden="true" className={className} style={{ perspective: "900px" }}>
      <svg
        viewBox="-8 -8 116 116"
        className="size-full"
        style={{ transform: "rotateX(38deg) rotateZ(-8deg)", overflow: "visible" }}
      >
        <defs>
          <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        <path
          d={path}
          fill="none"
          stroke="black"
          strokeOpacity="0.5"
          strokeWidth="9"
          strokeLinejoin="round"
          transform="translate(0 5)"
          filter={`url(#${id}-glow)`}
        />
        <path
          d={path}
          fill="none"
          stroke="var(--color-raised)"
          strokeWidth="7"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--color-line-strong)"
          strokeWidth="7.6"
          strokeLinejoin="round"
          strokeOpacity="0.6"
          style={{ mixBlendMode: "overlay" }}
        />
        <path
          d={path}
          fill="none"
          stroke={colour}
          strokeWidth="1.4"
          strokeLinejoin="round"
          strokeOpacity="0.9"
        />
        <path
          d={path}
          fill="none"
          stroke={colour}
          strokeWidth="5"
          strokeLinejoin="round"
          filter={`url(#${id}-glow)`}
          opacity="0.35"
        />
        <path
          d={path}
          pathLength={100}
          fill="none"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="5 95"
          style={{ animation: `lap ${String(LAP_SECONDS)}s linear infinite` }}
        />
        <path
          d={path}
          pathLength={100}
          fill="none"
          stroke={colour}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="5 95"
          filter={`url(#${id}-glow)`}
          style={{ animation: `lap ${String(LAP_SECONDS)}s linear infinite` }}
        />
      </svg>
    </div>
  );
}

import { useId } from "react";

/** Layers stacked under the top surface to give the track its thickness. */
const DEPTH_LAYERS = 14;
/** Vertical offset between two layers, in path units (100-unit box). */
const LAYER_STEP = 0.55;

/**
 * A circuit drawn as a raised ribbon seen from above at an angle: the outline is turned,
 * squashed into perspective and stacked layer by layer in a darker shade of its colour,
 * then topped with a lit surface. Decorative.
 */
export function ExtrudedCircuit({
  path,
  colour,
  className = "",
  width = 5,
}: {
  path: string;
  colour: string;
  className?: string;
  width?: number;
}) {
  const id = useId();
  const tilt = "rotate(-24 50 50) translate(0 0)";
  const squash = "translate(0 18) scale(1 0.62)";
  return (
    <svg aria-hidden="true" viewBox="-12 -6 124 100" className={className}>
      <defs>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={`color-mix(in oklab, ${colour} 55%, white)`} />
          <stop offset="1" stopColor={colour} />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <g transform={squash}>
        <g transform={tilt}>
          <path
            d={path}
            transform={`translate(0 ${String(DEPTH_LAYERS * LAYER_STEP + 4)})`}
            fill="none"
            stroke="black"
            strokeOpacity="0.55"
            strokeWidth={width * 1.6}
            strokeLinejoin="round"
            filter={`url(#${id}-shadow)`}
          />
        </g>
      </g>
      {Array.from({ length: DEPTH_LAYERS }, (_, i) => {
        const layer = DEPTH_LAYERS - i;
        const shade = 25 + (i / DEPTH_LAYERS) * 35;
        return (
          <g key={layer} transform={`translate(0 ${String(layer * LAYER_STEP)}) ${squash}`}>
            <g transform={tilt}>
              <path
                d={path}
                fill="none"
                stroke={`color-mix(in oklab, ${colour} ${String(shade)}%, black)`}
                strokeWidth={width}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          </g>
        );
      })}
      <g transform={squash}>
        <g transform={tilt}>
          <path
            d={path}
            fill="none"
            stroke={`url(#${id}-top)`}
            strokeWidth={width}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={path}
            fill="none"
            stroke="white"
            strokeOpacity="0.55"
            strokeWidth={width * 0.14}
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}

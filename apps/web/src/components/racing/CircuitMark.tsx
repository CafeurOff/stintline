/** A circuit layout from the API's compact card path (100-unit box), decorative. */
export function CircuitMark({
  path,
  className = "",
  stroke = "currentColor",
  width = 3,
}: {
  path: string;
  className?: string;
  stroke?: string;
  width?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="-4 -4 108 108"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

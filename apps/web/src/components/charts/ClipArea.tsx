import { type ReactNode, useId } from "react";

/** Draws its children only inside the plot area, so zoomed lines stop at the axes. */
export function ClipArea({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <>
      <clipPath id={id}>
        <rect width={width} height={height} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{children}</g>
    </>
  );
}

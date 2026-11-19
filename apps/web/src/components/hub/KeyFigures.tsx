export interface Figure {
  label: string;
  value: string | number;
}

/** Key numbers as a row of small tiles, read as a list of label/value pairs. */
export function KeyFigures({ figures, label }: { figures: readonly Figure[]; label: string }) {
  return (
    <dl
      aria-label={label}
      className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]"
    >
      {figures.map((figure) => (
        <div
          key={figure.label}
          className="glass reveal flex flex-col-reverse gap-1 rounded-2xl px-4 py-3.5"
        >
          <dt className="text-xs font-medium text-muted">{figure.label}</dt>
          <dd className="num display text-2xl">{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}

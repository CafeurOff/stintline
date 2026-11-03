export interface Figure {
  label: string;
  value: string | number;
}

/** A row of key numbers, read as a list of label/value pairs. */
export function KeyFigures({ figures, label }: { figures: readonly Figure[]; label: string }) {
  return (
    <dl aria-label={label} className="flex flex-wrap gap-x-8 gap-y-4">
      {figures.map((figure) => (
        <div key={figure.label} className="flex flex-col-reverse">
          <dt className="text-sm text-muted">{figure.label}</dt>
          <dd className="text-2xl font-bold tabular-nums">{figure.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Two-way tally as one bar split at the share of each side (qualifying 14 – 2). The counts
 * are written at both ends, so colour is never the only signal.
 */
export function SplitBar({
  label,
  counts,
  colours,
  note,
}: {
  label: string;
  counts: readonly number[];
  colours: readonly [string, string];
  note?: string;
}) {
  const a = counts[0] ?? 0;
  const b = counts[1] ?? 0;
  const total = a + b;
  const left = total === 0 ? 50 : (a / total) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="num text-lg font-bold">{a}</span>
        <span className="text-xs font-semibold tracking-wide text-muted uppercase">
          {label}
          {note && <span className="ml-1 normal-case">{note}</span>}
        </span>
        <span className="num text-lg font-bold">{b}</span>
      </div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        {total > 0 && (
          <>
            <span
              className="rounded-l-full"
              style={{ width: `${String(left)}%`, backgroundColor: colours[0] }}
            />
            <span className="flex-1 rounded-r-full" style={{ backgroundColor: colours[1] }} />
          </>
        )}
      </div>
    </div>
  );
}

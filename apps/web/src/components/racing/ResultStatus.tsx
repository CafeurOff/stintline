import { useI18n } from "@/lib/i18n/context";
import { outCode, outLabelKey, outShortKey } from "@/lib/results";

/**
 * Finishing place, or a short code for a car out of the classification (DNF, DNS, DSQ…)
 * spelled out on hover and for screen readers.
 */
export function ResultPosition({
  classification,
  position,
}: {
  classification: string | null | undefined;
  position: number | null | undefined;
}) {
  const { t } = useI18n();
  const code = outCode(classification);
  if (code === null) return <>{position ?? classification ?? "—"}</>;
  return (
    <abbr title={t(outLabelKey(code))} className="text-loss no-underline">
      <span aria-hidden="true">{t(outShortKey(code))}</span>
      <span className="sr-only">{t(outLabelKey(code))}</span>
    </abbr>
  );
}

/** Grid slot, "pit lane" for a car that started from the pits (grid 0). */
export function GridSlot({ grid }: { grid: number | null | undefined }) {
  const { t } = useI18n();
  if (grid === 0) return <>{t("result.pitLane")}</>;
  return <>{grid ?? "—"}</>;
}

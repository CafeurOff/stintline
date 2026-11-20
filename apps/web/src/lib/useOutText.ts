import { useI18n } from "@/lib/i18n/context";
import { outCause, outCode, outLabelKey } from "@/lib/results";

/** "Retired · Gearbox": why a car is out of the classification, or null when it is in. */
export function useOutText() {
  const { t, locale } = useI18n();
  return (classification: string | null | undefined, status: string | null | undefined) => {
    const code = outCode(classification);
    if (code === null) return null;
    const cause = outCause(status, locale);
    return cause ? `${t(outLabelKey(code))} · ${cause}` : t(outLabelKey(code));
  };
}

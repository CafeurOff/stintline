import { compoundInfo } from "@/lib/compounds";
import { useI18n } from "@/lib/i18n/context";

/** Tyre compound as a coloured disc with its letter: colour is never the only signal. */
export function CompoundBadge({ compound }: { compound: string | null | undefined }) {
  const { t } = useI18n();
  const info = compoundInfo(compound);
  const label = t(`compound.${info.key}`);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{ backgroundColor: info.fill }}
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold text-tyre-ink"
    >
      <span aria-hidden="true">{info.letter}</span>
    </span>
  );
}

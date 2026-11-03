import { Select } from "@/components/ui/Select";
import { useSeasons } from "@/features/session-picker/api";
import { useI18n } from "@/lib/i18n/context";

interface SeasonSelectProps {
  value: number | null;
  onChange: (year: number | null) => void;
  /** Offer "every season" as the first option. */
  allowAll?: boolean;
  label?: string;
}

/** Season picker over every stored season (1950 onwards), newest first. */
export function SeasonSelect({ value, onChange, allowAll = false, label }: SeasonSelectProps) {
  const { t } = useI18n();
  const seasons = useSeasons();
  const years = (seasons.data?.results ?? []).map((s) => s.year).sort((a, b) => b - a);
  if (value !== null && !years.includes(value)) years.unshift(value);

  return (
    <Select
      label={label ?? t("season.label")}
      value={value ?? ""}
      onChange={(event) => {
        onChange(event.target.value === "" ? null : Number(event.target.value));
      }}
    >
      {allowAll && <option value="">{t("season.all")}</option>}
      {years.map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </Select>
  );
}

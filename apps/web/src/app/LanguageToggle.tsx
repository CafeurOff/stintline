import { useI18n } from "@/lib/i18n/context";
import { LOCALES } from "@/lib/i18n/locale";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div role="group" aria-label={t("header.language")} className="flex">
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={option === locale}
          onClick={() => {
            setLocale(option);
          }}
          className="rounded-md px-2 py-1.5 text-muted uppercase aria-pressed:font-bold aria-pressed:text-ink"
        >
          {option}
        </button>
      ))}
    </div>
  );
}

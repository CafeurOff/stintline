import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "@/lib/theme";

/** Dark (default) and light themes. */
export function ThemeToggle() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const label = theme === "dark" ? t("theme.toLight") : t("theme.toDark");
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(theme === "dark" ? "light" : "dark");
      }}
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:text-ink"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
        <path d="M12 3a9 9 0 1 0 0 18V3z" />
        <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}

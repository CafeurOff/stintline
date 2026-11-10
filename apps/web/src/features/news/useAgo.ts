import { useI18n } from "@/lib/i18n/context";
import { useNow } from "@/lib/useNow";

const MINUTE_MS = 60_000;

/** "12 min ago", "3 h ago", "2 days ago", in the page language. */
export function useAgo() {
  const { locale } = useI18n();
  const now = useNow();
  const format = new Intl.RelativeTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    numeric: "auto",
    style: "short",
  });
  return (iso: string) => {
    const minutes = Math.round((new Date(iso).getTime() - now) / MINUTE_MS);
    if (Math.abs(minutes) < 60) return format.format(Math.min(minutes, 0), "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return format.format(hours, "hour");
    return format.format(Math.round(hours / 24), "day");
  };
}

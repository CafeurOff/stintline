import { useI18n } from "@/lib/i18n/context";

import { useApiHealth } from "./useApiHealth";

type Tone = "ok" | "warn" | "down";

const DOT_CLASS: Record<Tone, string> = { ok: "bg-gain", warn: "bg-caution", down: "bg-loss" };

/** Server status for the footer. Colour is never the only signal. */
export function ApiStatus() {
  const { t } = useI18n();
  const { data, isPending, isError } = useApiHealth();

  let tone: Tone;
  let label: string;
  if (isPending) {
    tone = "warn";
    label = t("api.checking");
  } else if (isError) {
    tone = "down";
    label = t("api.unreachable");
  } else if (data.status === "ok") {
    tone = "ok";
    label = t("api.online", { version: data.version });
  } else {
    tone = "down";
    label = t("api.degraded", { database: data.database });
  }

  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2">
      <span aria-hidden="true" className={`inline-block size-2 rounded-full ${DOT_CLASS[tone]}`} />
      {label}
    </p>
  );
}

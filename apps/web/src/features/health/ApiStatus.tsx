import { useApiHealth } from "./useApiHealth";

type Tone = "ok" | "warn" | "danger";

const DOT_CLASS: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  danger: "bg-danger",
};

/** Compact API status indicator for the header. Colour is never the only signal. */
export function ApiStatus() {
  const { data, isPending, isError } = useApiHealth();

  let tone: Tone;
  let label: string;
  if (isPending) {
    tone = "warn";
    label = "Checking API…";
  } else if (isError) {
    tone = "danger";
    label = "API unreachable";
  } else if (data.status === "ok") {
    tone = "ok";
    label = `API online · v${data.version}`;
  } else {
    tone = "danger";
    label = `API degraded (database ${data.database})`;
  }

  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-text-muted">
      <span aria-hidden="true" className={`inline-block size-2 rounded-full ${DOT_CLASS[tone]}`} />
      {label}
    </p>
  );
}

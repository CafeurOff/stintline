import { countryCode } from "@/lib/i18n/geo";

/** Country flag (flag-icons SVG). Decorative: the country or Grand Prix is written next to it. */
export function Flag({ country, className = "" }: { country: string; className?: string }) {
  const code = countryCode(country);
  if (!code) return null;
  return (
    <span aria-hidden="true" className={`fi fi-${code} shrink-0 rounded-[2px] ${className}`} />
  );
}

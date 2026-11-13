import { useI18n } from "@/lib/i18n/context";

import { CATEGORIES, CATEGORY_TONE, categoryKey } from "../categories";

/** A document's category as a coloured tag with its name (colour never alone). */
export function CategoryTag({ category }: { category: string }) {
  const { t } = useI18n();
  const known = CATEGORIES.find((c) => c === category) ?? "other";
  return (
    <span
      className={`rounded-md px-1.5 py-0.5 text-[0.65rem] font-bold tracking-wide whitespace-nowrap uppercase ${CATEGORY_TONE[known]}`}
    >
      {t(categoryKey(category))}
    </span>
  );
}

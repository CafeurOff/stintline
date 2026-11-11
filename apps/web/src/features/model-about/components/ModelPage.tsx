import type { Schema } from "@stintline/api-types";

import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { assumptionGroup, assumptionText } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

import { useModelCard } from "../api";
import { readBacktest } from "../backtest";

/** Race set never used for tuning: the honest measure of accuracy. */
const HELD_OUT = "held-out";

export function ModelPage() {
  const { t } = useI18n();
  const model = useModelCard();
  useDocumentTitle(t("model.title"));

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8 py-6 text-lg">
      <header>
        <h1 className="text-3xl font-bold">{t("model.title")}</h1>
        <p className="mt-3">{t("model.intro")}</p>
      </header>
      {model.isPending ? (
        <Skeleton className="h-48" />
      ) : model.isError ? (
        <ErrorState error={model.error} onRetry={() => void model.refetch()} />
      ) : (
        <>
          <section aria-labelledby="test-title">
            <h2 id="test-title" className="text-xl font-bold">
              {t("model.test.title")}
            </h2>
            <TestSummary backtest={model.data.backtest} />
          </section>
          <details>
            <summary className="cursor-pointer text-xl font-bold">{t("model.details")}</summary>
            <p className="mt-2 text-muted">
              {t("model.details.note")}{" "}
              <span className="tabular">({model.data.engine_version})</span>
            </p>
            <Assumptions assumptions={model.data.assumptions} />
          </details>
        </>
      )}
    </article>
  );
}

function Assumptions({ assumptions }: { assumptions: readonly Schema<"Assumption">[] }) {
  const { locale } = useI18n();
  const groups = new Map<string, Schema<"Assumption">[]>();
  for (const item of assumptions) groups.set(item.group, [...(groups.get(item.group) ?? []), item]);
  return (
    <div className="mt-4 flex flex-col gap-6 text-base">
      {[...groups.entries()].map(([group, items]) => (
        <section key={group} aria-label={assumptionGroup(group, locale)}>
          <h3 className="mb-1 font-bold">{assumptionGroup(group, locale)}</h3>
          <dl>
            {items.map((item) => (
              <div key={item.name} className="border-t border-line py-2">
                <dt className="flex justify-between gap-4">
                  <code className="text-sm text-muted">{item.name}</code>
                  <span className="tabular font-bold">{item.value}</span>
                </dt>
                <dd>
                  {assumptionText(group, item.name, item.description.replaceAll("``", ""), locale)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function TestSummary({ backtest }: { backtest: Record<string, unknown> }) {
  const { t, f } = useI18n();
  const overall = readBacktest(backtest, HELD_OUT)?.blind?.overall;
  if (!overall) return <p className="text-muted">{t("model.test.missing")}</p>;
  return (
    <>
      <p className="mt-2">
        {t("model.test.body", {
          n: overall.n,
          exact: f.percent(overall.exact_rate),
          within: f.percent(overall.within_one_rate),
        })}
      </p>
      <p className="mt-2">
        {t("model.test.compare", {
          mae: f.number(overall.mae, 2),
          baseline: f.number(overall.baseline_mae, 1),
        })}
      </p>
    </>
  );
}

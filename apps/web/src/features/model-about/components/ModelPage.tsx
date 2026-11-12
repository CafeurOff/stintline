import type { Schema } from "@stintline/api-types";

import { PageHeader } from "@/components/hub/PageHeader";
import { SectionTitle } from "@/components/hub/SectionTitle";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/States";
import { assumptionGroup, assumptionText } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/context";

import { useModelCard } from "../api";
import { readBacktest } from "../backtest";

const STEPS = ["laps", "fuel", "tyres", "stops"] as const;

/** Race set never used for tuning: the honest measure of accuracy. */
const HELD_OUT = "held-out";

export function ModelPage() {
  const { t } = useI18n();
  const model = useModelCard();

  return (
    <article className="flex flex-col gap-10">
      <PageHeader title={t("model.title")}>{t("model.intro")}</PageHeader>
      <section aria-labelledby="model-steps" className="flex flex-col gap-4">
        <SectionTitle id="model-steps">{t("model.steps.title")}</SectionTitle>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step}
              className="relative flex flex-col gap-2 overflow-hidden rounded-xl bg-panel p-5"
            >
              <span
                aria-hidden="true"
                className="absolute -top-4 -right-2 text-8xl font-extrabold text-raised select-none"
              >
                {index + 1}
              </span>
              <h3 className="relative text-lg font-extrabold uppercase">
                {t(`model.step.${step}.title`)}
              </h3>
              <p className="relative text-muted">{t(`model.step.${step}.body`)}</p>
            </li>
          ))}
        </ol>
      </section>
      {model.isPending ? (
        <Skeleton className="h-48" />
      ) : model.isError ? (
        <ErrorState error={model.error} onRetry={() => void model.refetch()} />
      ) : (
        <>
          <section aria-labelledby="test-title" className="flex flex-col gap-4">
            <SectionTitle id="test-title">{t("model.test.title")}</SectionTitle>
            <TestSummary backtest={model.data.backtest} />
          </section>
          <details className="rounded-xl bg-panel p-5">
            <summary className="cursor-pointer text-lg font-bold uppercase">
              {t("model.details")}
            </summary>
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
  const tiles = [
    [String(overall.n), t("model.tile.stops")],
    [f.percent(overall.exact_rate), t("model.tile.exact")],
    [f.percent(overall.within_one_rate), t("model.tile.within")],
    [
      f.number(overall.mae, 2),
      t("model.tile.mae", { baseline: f.number(overall.baseline_mae, 1) }),
    ],
  ] as const;
  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([value, label]) => (
          <div
            key={label}
            className="flex flex-col rounded-xl border border-line border-mark bg-panel p-5"
          >
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="order-first text-5xl font-extrabold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="max-w-3xl text-lg">
        {t("model.test.body", {
          n: overall.n,
          exact: f.percent(overall.exact_rate),
          within: f.percent(overall.within_one_rate),
        })}
      </p>
      <p className="max-w-3xl text-lg text-muted">
        {t("model.test.compare", {
          mae: f.number(overall.mae, 2),
          baseline: f.number(overall.baseline_mae, 1),
        })}
      </p>
    </>
  );
}

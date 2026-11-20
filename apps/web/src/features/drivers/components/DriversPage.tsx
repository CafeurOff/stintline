import type { CSSProperties } from "react";
import type { Schema } from "@stintline/api-types";
import { Link } from "react-router";

import { PageHeader } from "@/components/hub/PageHeader";
import { SeasonSelect } from "@/components/hub/SeasonSelect";
import { DriverAvatar } from "@/components/racing/DriverAvatar";
import { Bust } from "@/components/dash/Bust";
import { initials } from "@/components/racing/initials";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { useDrivers } from "@/lib/queries";
import { useCurrentSeason } from "@/lib/useCurrentSeason";
import { useI18n } from "@/lib/i18n/context";
import { nationalityCountry } from "@/lib/i18n/geo";
import { readable } from "@/lib/colour";
import { teamColour } from "@/lib/teams";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { intParam, useSearchParamsState } from "@/lib/useSearchParam";

/** Drivers of a season as a photo grid, or a search across every driver since 1950. */
export function DriversPage() {
  const { t } = useI18n();
  const [params, update] = useSearchParamsState();
  const current = useCurrentSeason();
  const query = params.get("q") ?? "";
  const search = useDebouncedValue(query.trim(), 250);
  // Searching looks across every season unless one is chosen explicitly.
  const chosen = params.get("season") === "all" ? null : intParam(params, "season");
  const season = chosen ?? (search || params.get("season") === "all" ? null : current.season);
  const drivers = useDrivers(search, season);

  return (
    <div>
      <PageHeader
        title={season === null ? t("drivers.title") : t("drivers.titleSeason", { year: season })}
      >
        {t("drivers.intro")}
      </PageHeader>
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <label className="flex min-w-64 flex-1 flex-col gap-1">
          <span className="text-sm text-muted">{t("drivers.search")}</span>
          <input
            type="search"
            value={query}
            placeholder={t("drivers.searchHint")}
            onChange={(event) => {
              update({ q: event.target.value || null });
            }}
            className="glass rounded-xl px-4 py-2.5 text-ink placeholder:text-muted"
          />
        </label>
        <SeasonSelect
          value={season}
          allowAll
          onChange={(value) => {
            update({ season: value ?? "all" });
          }}
        />
      </div>
      {drivers.isError ? (
        <ErrorState error={drivers.error} onRetry={() => void drivers.refetch()} />
      ) : !drivers.data ? (
        <Skeleton className="h-96" />
      ) : drivers.data.results.length === 0 ? (
        <EmptyState title={t("drivers.empty")} />
      ) : (
        <>
          {drivers.data.results.some((d) => d.season) ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[...drivers.data.results]
                .sort((a, b) => (a.season?.position ?? 99) - (b.season?.position ?? 99))
                .map((driver) => (
                  <li key={driver.ref}>
                    <DriverCard driver={driver} />
                  </li>
                ))}
            </ul>
          ) : (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {drivers.data.results.map((driver) => (
                <li key={driver.ref}>
                  <DriverTile driver={driver} />
                </li>
              ))}
            </ul>
          )}
          {drivers.data.count > drivers.data.results.length && (
            <p className="mt-6 text-sm text-muted">
              {t("drivers.more", { shown: drivers.data.results.length, total: drivers.data.count })}
            </p>
          )}
          <p className="mt-8 text-sm text-muted">{t("drivers.photoCredit")}</p>
        </>
      )}
    </div>
  );
}

type DriverItem = Schema<"DriverListItem">;

/** A driver of the chosen season: name, team, place and points, the car number behind. */
function DriverCard({ driver }: { driver: DriverItem }) {
  const { t, f } = useI18n();
  const colour = teamColour(driver.team?.colour);
  const season = driver.season;
  return (
    <Link
      to={`/drivers/${driver.ref}`}
      className="group glass glow reveal relative flex h-52 overflow-hidden rounded-[20px]"
      style={{ "--glow": colour, "--glow-x": "100%", "--glow-y": "100%" } as CSSProperties}
    >
      <Bust
        url={driver.photo_url ?? driver.portrait?.image_url}
        label={driver.code ?? initials(driver.given_name, driver.family_name)}
        colour={driver.team?.colour}
        className="absolute top-0 right-0 h-full w-[48%] transition-transform duration-500 group-hover:scale-[1.04]"
      />
      <span className="relative z-10 flex w-3/5 flex-col justify-between p-5">
        <span>
          <span className="block text-sm font-medium text-muted">{driver.given_name}</span>
          <span className="display block text-2xl leading-tight group-hover:underline">
            {driver.family_name}
          </span>
          {driver.team && (
            <span className="block text-sm font-bold" style={{ color: readable(colour) }}>
              {driver.team.name}
              {season && <span className="num ml-1.5 text-muted">#{season.car_number}</span>}
            </span>
          )}
        </span>
        {season?.position != null && (
          <span className="flex items-end gap-3">
            <span className="num timing text-5xl leading-none">
              {String(season.position).padStart(2, "0")}
            </span>
            <span className="pb-1 text-xs font-semibold text-muted">
              {t("common.points", { n: f.number(season.points ?? 0, 0) })}
            </span>
          </span>
        )}
      </span>
    </Link>
  );
}

/** Compact tile for searches across every season. */
function DriverTile({ driver }: { driver: DriverItem }) {
  const { locale } = useI18n();
  const name = `${driver.given_name} ${driver.family_name}`;
  return (
    <Link
      to={`/drivers/${driver.ref}`}
      className="group flex flex-col items-center gap-2 text-center"
    >
      <DriverAvatar
        label={driver.code ?? initials(driver.given_name, driver.family_name)}
        name={name}
        colour={driver.team?.colour}
        imageUrl={driver.photo_url ?? driver.portrait?.image_url}
        size="lg"
        decorative
      />
      <span className="leading-tight">
        <span className="block text-sm text-muted">{driver.given_name}</span>
        <span className="block font-bold group-hover:underline">{driver.family_name}</span>
      </span>
      {driver.team ? (
        <span className="flex items-center gap-1.5 text-sm text-muted">
          <span
            aria-hidden="true"
            className="h-3 w-1 rounded-full"
            style={{ backgroundColor: teamColour(driver.team.colour) }}
          />
          {driver.team.name}
        </span>
      ) : (
        driver.nationality && (
          <span className="text-sm text-muted">
            {nationalityCountry(driver.nationality, locale)}
          </span>
        )
      )}
    </Link>
  );
}

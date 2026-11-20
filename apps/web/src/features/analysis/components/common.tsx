import type { Schema } from "@stintline/api-types";
import { Link, NavLink } from "react-router";

import { Face } from "@/components/racing/Face";
import { useI18n } from "@/lib/i18n/context";

import { driverLabel } from "../season";

type Driver = Schema<"Driver">;

/** Driver face and name, linked to the profile. */
export function DriverChip({
  driver,
  colour,
  size = "size-9",
  sub,
  compact = false,
}: {
  driver: Driver;
  colour: string | null | undefined;
  size?: string;
  sub?: string | undefined;
  /** Family name only (dense tables). */
  compact?: boolean;
}) {
  return (
    <Link
      to={`/drivers/${driver.ref}`}
      className="flex min-w-0 items-center gap-2.5 hover:underline"
    >
      <Face
        url={driver.photo_url ?? driver.portrait_url}
        label={driverLabel(driver)}
        colour={colour}
        className={`${size} shrink-0 rounded-full text-xs`}
      />
      <span className="min-w-0 leading-tight">
        <span className="block truncate">
          {!compact && <span className="hidden sm:inline">{driver.given_name} </span>}
          <span className="font-semibold">{driver.family_name}</span>
        </span>
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </Link>
  );
}

/** Pills linking the analysis pages to one another. */
export function AnalysisTabs() {
  const { t } = useI18n();
  const links = [
    ["/analysis", "nav.headToHead"],
    ["/analysis/pace", "nav.pace"],
    ["/analysis/consistency", "nav.consistency"],
    ["/analysis/pit-stops", "nav.pitStops"],
    ["/circuits", "nav.circuits"],
  ] as const;
  return (
    <nav
      aria-label={t("nav.group.analysis")}
      className="-mt-2 mb-5 flex gap-2 overflow-x-auto pb-1"
    >
      {links.map(([to, key]) => (
        <TabLink key={to} to={to} label={t(key)} />
      ))}
    </nav>
  );
}

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
          isActive ? "border-ink bg-ink text-bg" : "border-line bg-panel text-muted hover:text-ink"
        }`
      }
    >
      {label}
    </NavLink>
  );
}

import { useEffect, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  Cog,
  Crosshair,
  FileText,
  Gauge,
  House,
  Info,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  RadioTower,
  Route,
  Swords,
  Trophy,
  type LucideIcon,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
import { Link, NavLink } from "react-router";

import { useLiveStatus } from "@/features/live/api";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/en";

import { LanguageToggle } from "./LanguageToggle";
import { isRailShortcut, useRail } from "./rail";

type Section = readonly [to: string, key: MessageKey, icon: LucideIcon];

/** The site map, grouped by what a fan is looking for. */
const GROUPS: readonly { key: MessageKey; links: readonly Section[] }[] = [
  {
    key: "nav.group.weekend",
    links: [
      ["/", "nav.home", House],
      ["/live", "nav.live", RadioTower],
      ["/calendar", "nav.calendar", CalendarDays],
    ],
  },
  {
    key: "nav.group.championship",
    links: [
      ["/standings", "nav.standings", Trophy],
      ["/drivers", "nav.drivers", UserRound],
      ["/teams", "nav.teams", UsersRound],
    ],
  },
  {
    key: "nav.group.analysis",
    links: [
      ["/analysis", "nav.headToHead", Swords],
      ["/analysis/pace", "nav.pace", ChartNoAxesColumn],
      ["/analysis/consistency", "nav.consistency", Crosshair],
      ["/analysis/pit-stops", "nav.pitStops", Wrench],
      ["/circuits", "nav.circuits", Route],
    ],
  },
  {
    key: "nav.group.paddock",
    links: [
      ["/news", "nav.news", Newspaper],
      ["/documents", "nav.documents", FileText],
      ["/technical", "nav.technical", Cog],
    ],
  },
  {
    key: "nav.group.about",
    links: [
      ["/model", "nav.model", BookOpen],
      ["/about", "nav.about", Info],
    ],
  },
];

const railLink = ({ isActive }: { isActive: boolean }) =>
  `relative mx-2 flex h-10 items-center gap-3 rounded-lg px-3 text-[0.92rem] transition-colors ${
    isActive
      ? "bg-ink font-semibold text-bg [&>svg]:text-bg"
      : "text-muted hover:bg-raised hover:text-ink"
  }`;

/** `compact`: the desktop rail keeps only the badge when it is reduced. */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="StintLine">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-[10px] bg-mark text-white shadow-[0_6px_18px_-4px_var(--color-mark)]"
      >
        <Gauge className="size-5" strokeWidth={2.25} />
      </span>
      <span
        className={`text-lg leading-none font-extrabold tracking-tight ${compact ? "lg:rail-collapsed:hidden" : ""}`}
      >
        Stint<span className="text-mark-text">Line</span>
      </span>
    </Link>
  );
}

interface Tip {
  label: string;
  top: number;
}

/**
 * The site map. In the desktop rail (`rail`), the reduced state keeps the icons: names
 * stay for screen readers, group titles become dividers and `onTip` shows the name beside
 * the icon on hover and focus.
 */
export function NavGroups({
  onPick,
  rail = false,
  onTip,
}: {
  onPick?: () => void;
  rail?: boolean;
  onTip?: ((tip: Tip | null) => void) | undefined;
}) {
  const { t } = useI18n();
  const show = (label: string) => (event: { currentTarget: HTMLElement }) => {
    const box = event.currentTarget.getBoundingClientRect();
    onTip?.({ label, top: box.top + box.height / 2 });
  };
  const hide = () => {
    onTip?.(null);
  };
  return (
    <>
      {GROUPS.map((group) => (
        <div key={group.key} className="flex flex-col">
          <span
            className={`px-5 pt-5 pb-1.5 text-[0.7rem] font-semibold tracking-wider text-muted/80 uppercase ${rail ? "rail-collapsed:sr-only" : ""}`}
          >
            {t(group.key)}
          </span>
          {rail && (
            <span
              aria-hidden="true"
              className="mx-4 mt-3 mb-2 hidden h-px bg-line rail-collapsed:block"
            />
          )}
          <ul className="flex flex-col">
            {group.links.map(([to, key, Icon]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/" || to === "/analysis"}
                  className={(state) =>
                    `${railLink(state)} ${rail ? "rail-collapsed:mx-auto rail-collapsed:w-10 rail-collapsed:justify-center rail-collapsed:px-0" : ""}`
                  }
                  onClick={onPick}
                  onMouseEnter={rail ? show(t(key)) : undefined}
                  onFocus={rail ? show(t(key)) : undefined}
                  onMouseLeave={rail ? hide : undefined}
                  onBlur={rail ? hide : undefined}
                >
                  <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.75} />
                  <span className={`flex-1 ${rail ? "rail-collapsed:sr-only" : ""}`}>{t(key)}</span>
                  {to === "/live" && (
                    <LiveMark
                      className={
                        rail
                          ? "rail-collapsed:absolute rail-collapsed:top-1.5 rail-collapsed:right-1.5"
                          : ""
                      }
                    />
                  )}
                  {to === "/live" && <LiveNote />}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/**
 * Desktop: the site map in a fixed rail, which the reader can reduce to icons (button or
 * `[`, remembered). Phones get a top bar and a drawer instead.
 */
export function Rail() {
  const { t } = useI18n();
  const { rail, toggle } = useRail();
  const [tip, setTip] = useState<Tip | null>(null);
  const collapsed = rail === "collapsed";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isRailShortcut(event)) return;
      event.preventDefault();
      setTip(null);
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [toggle]);

  const label = collapsed ? t("nav.expand") : t("nav.collapse");
  return (
    <div className="hidden border-r border-line bg-bg lg:block">
      <div className="sticky top-0 flex h-screen flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-line px-5 rail-collapsed:justify-center rail-collapsed:px-0">
          <Wordmark compact />
        </div>
        <nav
          id="site-rail"
          aria-label={t("nav.label")}
          className="flex-1 overflow-x-hidden overflow-y-auto pb-4"
        >
          <NavGroups rail onTip={collapsed ? setTip : undefined} />
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2 rail-collapsed:flex-col rail-collapsed:px-2">
          <LanguageToggle className="rail-collapsed:flex-col" />
          <button
            type="button"
            onClick={() => {
              setTip(null);
              toggle();
            }}
            aria-controls="site-rail"
            aria-expanded={!collapsed}
            aria-label={label}
            title={`${label} ([)`}
            className="grid size-9 place-items-center rounded-lg text-muted hover:bg-raised hover:text-ink"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>
      {collapsed && tip && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed left-[4.75rem] z-50 -translate-y-1/2 rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-bg shadow-lg"
          style={{ top: tip.top }}
        >
          {tip.label}
        </div>
      )}
    </div>
  );
}

/** Live state as on a timing screen: a kerb flag when a session runs, a grey tick otherwise. */
function LiveMark({ className = "" }: { className?: string }) {
  const live = useLiveStatus().data?.state === "live";
  return (
    <span
      aria-hidden="true"
      className={`size-2 rounded-full ${live ? "animate-pulse bg-mark" : "bg-line-strong"} ${className}`}
    />
  );
}

function LiveNote() {
  const { t } = useI18n();
  const live = useLiveStatus().data?.state === "live";
  return live ? <span className="sr-only"> ({t("live.now")})</span> : null;
}

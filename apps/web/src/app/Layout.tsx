import { Suspense } from "react";
import { Link, Outlet, ScrollRestoration, useMatch } from "react-router";

import { Skeleton } from "@/components/ui/Skeleton";
import { ApiStatus } from "@/features/health/ApiStatus";
import { useI18n } from "@/lib/i18n/context";

import { ContextBar, RaceBar } from "./ContextBar";
import { Rail } from "./Navigation";
import { RouteAnnouncer } from "./RouteAnnouncer";

export function Layout() {
  const { t } = useI18n();
  const tyres = useMatch("/sessions/:sessionId/tyres");
  const race = useMatch("/sessions/:sessionId");
  const raw = (tyres ?? race)?.params.sessionId;
  const sessionId = raw && /^\d+$/.test(raw) ? Number(raw) : null;

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[14.5rem_minmax(0,1fr)] motion-safe:lg:transition-[grid-template-columns] motion-safe:lg:duration-200 lg:rail-collapsed:grid-cols-[4.5rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only z-50 bg-panel px-3 py-2 focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        {t("app.skip")}
      </a>
      <Rail />
      <div className="flex min-h-screen min-w-0 flex-col">
        <ContextBar>
          {sessionId !== null && <RaceBar sessionId={sessionId} onTyres={tyres !== null} />}
        </ContextBar>
        <div className="mx-auto flex w-full max-w-[1840px] flex-1 flex-col px-4 pt-6 sm:px-8">
          {/* At least a screen tall: the footer starts below the fold, so a page filling in after
              its data arrives does not push it down in view (layout shift). */}
          <main id="main" tabIndex={-1} className="min-h-svh flex-1 pb-16 outline-none">
            <Suspense fallback={<Skeleton className="h-[60vh]" />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
        <SiteFooter />
      </div>
      <ScrollRestoration />
      <RouteAnnouncer />
    </div>
  );
}

function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-[1840px] flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          {t("app.disclaimer")}{" "}
          <Link to="/about" className="font-semibold underline underline-offset-2 hover:text-ink">
            {t("nav.about")}
          </Link>
        </p>
        <ApiStatus />
      </div>
    </footer>
  );
}

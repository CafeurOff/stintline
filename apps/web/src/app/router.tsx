import { type ComponentType, lazy, Suspense } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";

import { HomePage } from "@/features/home/components/HomePage";
import { NotFoundPage } from "@/features/home/NotFoundPage";

import { Layout } from "./Layout";

/** Loads a page module on first visit, so the home page does not ship every chart.
 * The layout wraps the outlet in Suspense: the header shows while the page loads. */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(async () => ({ default: (await load())[name] }));
}

const LivePage = page(() => import("@/features/live/components/LivePage"), "LivePage");
const NewsPage = page(() => import("@/features/news/components/NewsPage"), "NewsPage");
const ReportPage = page(() => import("@/features/news/components/ReportPage"), "ReportPage");
const CalendarPage = page(
  () => import("@/features/calendar/components/CalendarPage"),
  "CalendarPage",
);
const EventPage = page(() => import("@/features/event/components/EventPage"), "EventPage");
const DriversPage = page(() => import("@/features/drivers/components/DriversPage"), "DriversPage");
const DriverPage = page(() => import("@/features/drivers/components/DriverPage"), "DriverPage");
const TeamsPage = page(() => import("@/features/teams/components/TeamsPage"), "TeamsPage");
const TeamPage = page(() => import("@/features/teams/components/TeamPage"), "TeamPage");
const StandingsPage = page(
  () => import("@/features/standings/components/StandingsPage"),
  "StandingsPage",
);
const RacePage = page(() => import("@/features/race/components/RacePage"), "RacePage");
const TyresPage = page(() => import("@/features/tyres/components/TyresPage"), "TyresPage");
const ModelPage = page(() => import("@/features/model-about/components/ModelPage"), "ModelPage");
const DirectionsPage = page(
  () => import("@/features/home/components/directions/DirectionsPage"),
  "DirectionsPage",
);

/** Design review pages, only in the development server (never in a production build). */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: "dev/directions",
        element: (
          <Suspense fallback={null}>
            <DirectionsPage />
          </Suspense>
        ),
      },
    ]
  : [];

export const routes: RouteObject[] = [
  ...devRoutes,
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "live", element: <LivePage /> },
      { path: "news", element: <NewsPage /> },
      { path: "news/:sessionId", element: <ReportPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "calendar/:year", element: <CalendarPage /> },
      { path: "events/:eventId", element: <EventPage /> },
      { path: "drivers", element: <DriversPage /> },
      { path: "drivers/:ref", element: <DriverPage /> },
      { path: "teams", element: <TeamsPage /> },
      { path: "teams/:ref", element: <TeamPage /> },
      { path: "standings", element: <StandingsPage /> },
      { path: "standings/:year", element: <StandingsPage /> },
      { path: "sessions/:sessionId", element: <RacePage /> },
      { path: "sessions/:sessionId/tyres", element: <TyresPage /> },
      { path: "model", element: <ModelPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

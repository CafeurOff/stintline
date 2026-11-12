import { type ComponentType, lazy } from "react";
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
const HeadToHeadPage = page(
  () => import("@/features/insights/components/HeadToHeadPage"),
  "HeadToHeadPage",
);
const PacePage = page(() => import("@/features/insights/components/PacePage"), "PacePage");
const ConsistencyPage = page(
  () => import("@/features/insights/components/ConsistencyPage"),
  "ConsistencyPage",
);
const PitStopsPage = page(
  () => import("@/features/insights/components/PitStopsPage"),
  "PitStopsPage",
);
const CircuitsPage = page(
  () => import("@/features/insights/components/CircuitsPage"),
  "CircuitsPage",
);
const ModelPage = page(() => import("@/features/model-about/components/ModelPage"), "ModelPage");

export const routes: RouteObject[] = [
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
      { path: "analysis", element: <HeadToHeadPage /> },
      { path: "analysis/pace", element: <PacePage /> },
      { path: "analysis/consistency", element: <ConsistencyPage /> },
      { path: "analysis/pit-stops", element: <PitStopsPage /> },
      { path: "circuits", element: <CircuitsPage /> },
      { path: "circuits/:ref", element: <CircuitsPage /> },
      { path: "model", element: <ModelPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

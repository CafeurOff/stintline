import { createBrowserRouter, type RouteObject } from "react-router";

import { CalendarPage } from "@/features/calendar/components/CalendarPage";
import { DriverPage } from "@/features/drivers/components/DriverPage";
import { DriversPage } from "@/features/drivers/components/DriversPage";
import { EventPage } from "@/features/event/components/EventPage";
import { HomePage } from "@/features/home/components/HomePage";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { ModelPage } from "@/features/model-about/components/ModelPage";
import { RacePage } from "@/features/race/components/RacePage";
import { StandingsPage } from "@/features/standings/components/StandingsPage";
import { TeamPage } from "@/features/teams/components/TeamPage";
import { TeamsPage } from "@/features/teams/components/TeamsPage";
import { TyresPage } from "@/features/tyres/components/TyresPage";

import { Layout } from "./Layout";

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
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

import { createBrowserRouter, type RouteObject } from "react-router";

import { HomeRedirect } from "@/features/home/HomeRedirect";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { ModelPage } from "@/features/model-about/components/ModelPage";
import { RacePage } from "@/features/race/components/RacePage";
import { TyresPage } from "@/features/tyres/components/TyresPage";

import { Layout } from "./Layout";

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomeRedirect /> },
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

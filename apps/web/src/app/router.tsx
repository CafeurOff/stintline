import { createBrowserRouter, type RouteObject } from "react-router";

import { DegradationPage } from "@/features/degradation/components/DegradationPage";
import { HomePage } from "@/features/home/HomePage";
import { NotFoundPage } from "@/features/home/NotFoundPage";
import { ModelPage } from "@/features/model-about/components/ModelPage";
import { SessionLayout } from "@/features/race-strategy/components/SessionLayout";
import { StrategyPage } from "@/features/race-strategy/components/StrategyPage";
import { SimulatorPage } from "@/features/simulator/components/SimulatorPage";

import { Layout } from "./Layout";

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: "sessions/:sessionId",
        element: <SessionLayout />,
        children: [
          { index: true, element: <StrategyPage /> },
          { path: "degradation", element: <DegradationPage /> },
          { path: "simulator", element: <SimulatorPage /> },
        ],
      },
      { path: "model", element: <ModelPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("ApiStatus", () => {
  it("shows the API version when healthy", async () => {
    renderRoute("/model");

    expect(await screen.findByText("Server online · v0.1.0")).toBeInTheDocument();
  });

  it("shows a checking state while the request is pending", () => {
    renderRoute("/model");

    expect(screen.getByText("Checking the server…")).toHaveAttribute("role", "status");
  });

  it("explains a degraded API using the 503 body", async () => {
    server.use(
      http.get("*/api/v1/health", () =>
        HttpResponse.json(
          { status: "unavailable", version: "0.1.0", database: "unavailable" },
          { status: 503 },
        ),
      ),
    );
    renderRoute("/model");

    expect(await screen.findByText("Server degraded (database unavailable)")).toBeInTheDocument();
  });

  it("reports an unreachable API on network failure", async () => {
    server.use(http.get("*/api/v1/health", () => HttpResponse.error()));
    renderRoute("/model");

    expect(await screen.findByText("Server unreachable")).toBeInTheDocument();
  });

  it("reports an unreachable API when the body is empty", async () => {
    server.use(http.get("*/api/v1/health", () => new HttpResponse(null, { status: 204 })));
    renderRoute("/model");

    expect(await screen.findByText("Server unreachable")).toBeInTheDocument();
  });
});

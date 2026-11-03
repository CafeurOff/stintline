import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("ApiStatus", () => {
  it("shows the API version when healthy", async () => {
    renderRoute();

    expect(await screen.findByText("API online · v0.1.0")).toBeInTheDocument();
  });

  it("shows a checking state while the request is pending", () => {
    renderRoute();

    expect(screen.getByText("Checking API…")).toHaveAttribute("role", "status");
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
    renderRoute();

    expect(await screen.findByText("API degraded (database unavailable)")).toBeInTheDocument();
  });

  it("reports an unreachable API on network failure", async () => {
    server.use(http.get("*/api/v1/health", () => HttpResponse.error()));
    renderRoute();

    expect(await screen.findByText("API unreachable")).toBeInTheDocument();
  });

  it("reports an unreachable API when the body is empty", async () => {
    server.use(http.get("*/api/v1/health", () => new HttpResponse(null, { status: 204 })));
    renderRoute();

    expect(await screen.findByText("API unreachable")).toBeInTheDocument();
  });
});

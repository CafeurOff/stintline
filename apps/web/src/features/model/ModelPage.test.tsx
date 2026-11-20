import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { model } from "@/test/fixtures/model";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("ModelPage", () => {
  it("states the held-out accuracy in plain words", async () => {
    renderRoute("/model");

    expect(await screen.findByText(/155 real pit stops/)).toHaveTextContent(
      "exact 49% of the time and within one place 79% of the time",
    );
    expect(screen.getByText(/off by 0.86 places/)).toHaveTextContent("would be off by 4.7");
  });

  it("keeps the assumptions behind a disclosure, translated", async () => {
    renderRoute("/model", { locale: "fr" });

    await userEvent.click(await screen.findByText("Réglages et hypothèses"));

    const fuel = screen.getByRole("region", { name: "Carburant" });
    expect(within(fuel).getByText("seconds_per_kg")).toBeVisible();
    expect(within(fuel).getByText(/Temps perdu par kilo/)).toBeVisible();
  });

  it("says when test results are missing", async () => {
    server.use(http.get("*/api/v1/model", () => HttpResponse.json({ ...model, backtest: {} })));
    renderRoute("/model");

    expect(await screen.findByText("Test results are not available.")).toBeVisible();
  });
});

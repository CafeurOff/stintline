import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { model } from "@/test/fixtures/model";
import { renderRoute } from "@/test/render";
import { server } from "@/test/server";

describe("ModelPage", () => {
  it("shows held-out backtest metrics against the baseline", async () => {
    renderRoute("/model");

    const heldOut = await screen.findByRole("region", { name: "Held-out races" });
    expect(within(heldOut).getByText("0.86 pos")).toBeVisible();
    expect(within(heldOut).getByText("baseline 4.68")).toBeVisible();
    expect(within(heldOut).getByText("155 stops")).toBeVisible();
  });

  it("breaks the backtest down per race", async () => {
    renderRoute("/model");
    const heldOut = await screen.findByRole("region", { name: "Held-out races" });

    await userEvent.click(within(heldOut).getByText("Per race and mode"));

    expect(within(heldOut).getAllByRole("row", { name: /Austrian Grand Prix/ })).toHaveLength(2);
  });

  it("lists assumptions by group with inline code", async () => {
    renderRoute("/model");

    const cleaning = await screen.findByRole("region", { name: "Lap cleaning" });
    const mentions = within(cleaning).getAllByText("outlier_k");
    expect(mentions.map((element) => element.tagName)).toEqual(["DT", "CODE"]);
  });

  it("degrades gracefully when the backtest report is missing", async () => {
    server.use(http.get("*/api/v1/model", () => HttpResponse.json({ ...model, backtest: {} })));
    renderRoute("/model");

    expect(await screen.findAllByText("Backtest results not available")).toHaveLength(2);
  });
});

import { screen } from "@testing-library/react";

import { renderWithProviders } from "@/test/render";

import { Panel, PanelFooter, Tile } from "./Panel";

describe("Panel and Tile", () => {
  it("are regions named by their title", () => {
    renderWithProviders(
      <>
        <Panel title="Results" action={<button type="button">Filter</button>}>
          <PanelFooter>
            <a href="/x">All</a>
          </PanelFooter>
        </Panel>
        <Tile label="Fastest lap">1:12.689</Tile>
      </>,
    );

    expect(screen.getByRole("region", { name: "Results" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Fastest lap" })).toHaveTextContent("1:12.689");
    expect(screen.getByRole("link", { name: "All" })).toBeVisible();
  });
});

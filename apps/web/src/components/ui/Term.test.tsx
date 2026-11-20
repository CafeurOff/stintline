import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "@/test/render";

import { Term, TermList } from "./Term";

describe("glossary terms", () => {
  it("explains a word on focus and closes with Escape", async () => {
    renderWithProviders(<Term id="undercut" />);
    const word = screen.getByRole("button", { name: "Undercut" });

    await userEvent.tab();
    expect(word).toHaveFocus();
    expect(screen.getByRole("tooltip")).toHaveTextContent(/Pitting before the car ahead/);
    expect(word).toHaveAccessibleDescription(/Pitting before the car ahead/);

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on a tap and closes on a tap elsewhere or a scroll", () => {
    renderWithProviders(
      <>
        <Term id="median">the median</Term>
        <p>elsewhere</p>
      </>,
    );
    const word = screen.getByRole("button", { name: "the median" });

    fireEvent.click(word);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Median");
    fireEvent.pointerDown(screen.getByText("elsewhere"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(word);
    fireEvent.click(word);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.click(word);
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows on mouse hover only, not on a touch", () => {
    renderWithProviders(<Term id="stint" />);
    const word = screen.getByRole("button", { name: "Stint" });

    fireEvent.pointerEnter(word, { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.pointerEnter(word, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.pointerLeave(word, { pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("lists the words of a page in French", () => {
    renderWithProviders(<TermList ids={["pitLoss", "stdDev"]} />, { locale: "fr" });

    expect(screen.getByText("Les mots de cette page :")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Perte au stand" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Écart-type" })).toBeInTheDocument();
  });

  it("lists nothing when a page has no words", () => {
    const { container } = renderWithProviders(<TermList ids={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

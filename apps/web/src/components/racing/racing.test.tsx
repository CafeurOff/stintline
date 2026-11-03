import { fireEvent, screen } from "@testing-library/react";

import { renderWithProviders } from "@/test/render";

import { CompoundBadge } from "./CompoundBadge";
import { DriverAvatar } from "./DriverAvatar";

describe("DriverAvatar", () => {
  it("shows the official portrait without leaking the referrer", () => {
    renderWithProviders(
      <DriverAvatar
        carNumber={4}
        name="Lando Norris"
        colour="F47600"
        imageUrl="https://example.test/nor.webp"
      />,
    );

    expect(screen.getByRole("img", { name: "Lando Norris" })).toHaveAttribute(
      "referrerpolicy",
      "no-referrer",
    );
  });

  it("falls back to a numbered avatar when the portrait fails or is missing", () => {
    renderWithProviders(
      <>
        <DriverAvatar
          carNumber={4}
          name="Lando Norris"
          colour="F47600"
          imageUrl="https://example.test/nor.webp"
        />
        <DriverAvatar carNumber={43} name="Franco Colapinto" colour="00A1E8" imageUrl={null} />
      </>,
    );

    fireEvent.error(screen.getByRole("img", { name: "Lando Norris" }));

    expect(screen.getByRole("img", { name: "Lando Norris" })).toHaveTextContent("4");
    expect(screen.getByRole("img", { name: "Franco Colapinto" })).toHaveTextContent("43");
  });
});

describe("CompoundBadge", () => {
  it("names the compound in the reader's language", () => {
    renderWithProviders(<CompoundBadge compound="HARD" />, { locale: "fr" });

    expect(screen.getByRole("img", { name: "Dur" })).toHaveTextContent("H");
  });
});

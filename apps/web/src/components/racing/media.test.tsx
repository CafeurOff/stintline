import { fireEvent, render, screen } from "@testing-library/react";

import { CarImage } from "./CarImage";
import { CompoundBadge } from "./CompoundBadge";
import { DriverAvatar } from "./DriverAvatar";

describe("DriverAvatar", () => {
  it("shows the official portrait without leaking the referrer", () => {
    render(
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

  it("falls back to a numbered avatar when the portrait fails", () => {
    render(
      <DriverAvatar
        carNumber={4}
        name="Lando Norris"
        colour="F47600"
        imageUrl="https://example.test/nor.webp"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Lando Norris" }));

    expect(screen.getByRole("img", { name: "Lando Norris" })).toHaveTextContent("4");
  });

  it("uses the numbered avatar when media is disabled", () => {
    render(<DriverAvatar carNumber={43} name="Franco Colapinto" colour="00A1E8" imageUrl={null} />);

    expect(screen.getByRole("img", { name: "Franco Colapinto" })).toHaveTextContent("43");
  });
});

describe("CarImage", () => {
  it("falls back to the original silhouette when the render fails", () => {
    render(
      <CarImage teamName="McLaren" colour="F47600" imageUrl="https://example.test/car.webp" />,
    );

    fireEvent.error(screen.getByRole("img", { name: "McLaren car" }));

    expect(screen.getByRole("img", { name: "McLaren car" }).tagName).toBe("svg");
  });
});

describe("CompoundBadge", () => {
  it("names the compound for assistive tech", () => {
    render(<CompoundBadge compound="HARD" />);

    expect(screen.getByRole("img", { name: "Hard" })).toHaveTextContent("H");
  });
});

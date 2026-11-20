import { fireEvent, screen } from "@testing-library/react";
import type { Schema } from "@stintline/api-types";

import { GridSlot, ResultPosition } from "@/components/racing/ResultStatus";
import { HeadlineThumb } from "@/features/news/components/HeadlineThumb";
import { renderWithProviders } from "@/test/render";

import { fiaSessionLabel } from "./i18n/content";
import { outCause, outCode } from "./results";
import { sessionLabel, sessionShort } from "./sessions";

const headline = (image: string | null): Schema<"Headline"> => ({
  source: "autosport",
  source_name: "Autosport",
  language: "en",
  title: "Title",
  url: "https://example.org",
  published_at: "2026-11-19T10:00:00Z",
  image_url: image,
});

describe("race results helpers", () => {
  it("knows the codes of cars out of the classification", () => {
    expect(outCode("R")).toBe("R");
    expect(outCode("3")).toBeNull();
    expect(outCode(null)).toBeNull();
  });

  it("gives the cause of a retirement in the reader's language", () => {
    expect(outCause("Gearbox", "fr")).toBe("Boîte de vitesses");
    expect(outCause("Gearbox", "en")).toBe("Gearbox");
    expect(outCause("Something odd", "fr")).toBe("Something odd");
    expect(outCause("Retired", "fr")).toBeNull();
    expect(outCause("+2 Laps", "en")).toBeNull();
    expect(outCause(null, "en")).toBeNull();
  });

  it("spells out a short code and keeps a place as it is", () => {
    renderWithProviders(<ResultPosition classification="W" position={null} />);
    expect(screen.getByTitle("Did not start")).toHaveTextContent("DNS");

    renderWithProviders(<ResultPosition classification="4" position={4} />);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("names a pit lane start", () => {
    renderWithProviders(<GridSlot grid={0} />);
    expect(screen.getByText("Pit lane")).toBeInTheDocument();
    renderWithProviders(<GridSlot grid={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("translates the FIA session labels", () => {
    expect(fiaSessionLabel("Free Practice 3", "fr")).toBe("Essais libres 3");
    expect(fiaSessionLabel("Practice 2", "en")).toBe("Free Practice 2");
    expect(fiaSessionLabel("Unknown", "fr")).toBe("Unknown");
    expect(fiaSessionLabel(null, "fr")).toBe("");
  });

  it("has short and full session names", () => {
    const t = (key: string) => key;
    expect(sessionShort("FP1", t as never)).toBe("session.short.FP1");
    expect(sessionShort("XX", t as never)).toBe("XX");
    expect(sessionLabel("XX", t as never)).toBe("XX");
  });
});

describe("headline thumbnails", () => {
  it("shows the source when there is no picture or it breaks", () => {
    const { container, unmount } = renderWithProviders(
      <HeadlineThumb headline={headline("https://img.example/a.jpg")} className="" eager />,
    );
    const img = container.querySelector("img");
    if (!img) throw new Error("no picture");
    expect(img).toHaveAttribute("loading", "eager");
    fireEvent.error(img);
    expect(screen.getByText("Autosport")).toBeInTheDocument();

    unmount();
    renderWithProviders(<HeadlineThumb headline={headline(null)} className="" />);
    expect(screen.getByText("Autosport")).toBeInTheDocument();
  });
});

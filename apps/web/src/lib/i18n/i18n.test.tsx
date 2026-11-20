import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { assumptionGroup, assumptionText, eventName } from "./content";
import { useI18n } from "./context";
import { en } from "./en";
import { fr } from "./fr";
import { I18nProvider } from "./I18nProvider";
import { interpolate } from "./interpolate";
import { initialLocale, LOCALE_STORAGE_KEY, localePath, pathLocale } from "./locale";

function Probe() {
  const { t, locale, setLocale } = useI18n();
  return (
    <>
      <p>{t("stop.question", { name: "Norris" })}</p>
      <button
        type="button"
        onClick={() => {
          setLocale(locale === "en" ? "fr" : "en");
        }}
      >
        switch
      </button>
    </>
  );
}

describe("i18n", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("defines every English key in French", () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it("interpolates parameters and switches language", async () => {
    render(
      <I18nProvider locale="en">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("What if Norris pitted now?")).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(await screen.findByText("Et si Norris s'arrêtait maintenant ?")).toBeVisible();
    expect(document.documentElement.lang).toBe("fr");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
  });

  it("reads the language from the address and builds the other one", () => {
    expect(pathLocale("/fr")).toBe("fr");
    expect(pathLocale("/fr/drivers/norris")).toBe("fr");
    expect(pathLocale("/francais")).toBe("en");
    expect(pathLocale("/drivers")).toBe("en");
    expect(localePath("/drivers/norris", "fr")).toBe("/fr/drivers/norris");
    expect(localePath("/", "fr")).toBe("/fr/");
    expect(localePath("/fr/drivers/norris", "en")).toBe("/drivers/norris");
    expect(localePath("/fr", "en")).toBe("/");
    expect(localePath("/fr/standings", "fr")).toBe("/fr/standings");
  });

  it("hands the switch to the app when it opens pages by address", async () => {
    const opened: string[] = [];
    render(
      <I18nProvider locale="en" onSwitch={(next) => opened.push(next)}>
        <Probe />
      </I18nProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "switch" }));

    expect(opened).toEqual(["fr"]);
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
    expect(screen.getByText("What if Norris pitted now?")).toBeVisible();
  });

  it("starts from the stored choice, then the browser language", () => {
    vi.stubGlobal("navigator", { language: "fr-CA" });
    expect(initialLocale()).toBe("fr");
    localStorage.setItem(LOCALE_STORAGE_KEY, "en");
    expect(initialLocale()).toBe("en");
  });

  it("refuses to be used without its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Probe />)).toThrow(/I18nProvider/);
  });

  it("translates race names and assumptions in French only", () => {
    expect(eventName("Hungarian Grand Prix", "fr")).toBe("Grand Prix de Hongrie");
    expect(eventName("Hungarian Grand Prix", "en")).toBe("Hungarian Grand Prix");
    expect(eventName("Moon Grand Prix", "fr")).toBe("Moon Grand Prix");
    expect(assumptionGroup("Fuel", "fr")).toBe("Carburant");
    expect(assumptionText("Fuel", "unknown", "as is", "fr")).toBe("as is");
    expect(assumptionText("Pit loss", "outlier_k", "en", "fr")).toMatch(/arrêts trop éloignés/);
  });
});

describe("interpolate", () => {
  it("agrees words with a number in each language", () => {
    expect(interpolate("{n} {n|lap|laps}", { n: 1 }, "en")).toBe("1 lap");
    expect(interpolate("{n} {n|lap|laps}", { n: 0 }, "en")).toBe("0 laps");
    expect(interpolate("{n} {n|tour|tours}", { n: 0 }, "fr")).toBe("0 tour");
    expect(interpolate("{n} {n|tour|tours}", { n: 3 }, "fr")).toBe("3 tours");
    expect(interpolate("{n|a|b}", {}, "en")).toBe("{n|a|b}");
  });

  it("keeps French punctuation on the line of its word", () => {
    expect(interpolate("Et maintenant ?", undefined, "fr")).toBe("Et maintenant ?");
    expect(interpolate("Now ?", undefined, "en")).toBe("Now ?");
  });
});

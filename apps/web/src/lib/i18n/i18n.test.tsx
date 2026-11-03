import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { assumptionGroup, assumptionText, eventName } from "./content";
import { useI18n } from "./context";
import { en } from "./en";
import { fr } from "./fr";
import { I18nProvider } from "./I18nProvider";
import { initialLocale, LOCALE_STORAGE_KEY } from "./locale";

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

    expect(screen.getByText("Et si Norris s'arrêtait maintenant ?")).toBeVisible();
    expect(document.documentElement.lang).toBe("fr");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("fr");
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

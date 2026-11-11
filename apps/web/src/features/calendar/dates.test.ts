import { describe, expect, it } from "vitest";

import { events } from "@/test/fixtures/events";

import { weekendDates } from "./dates";

describe("weekendDates", () => {
  const hungary = events.results.find((e) => e.round === 14);

  it("spans the weekend from the first session to race day", () => {
    expect(hungary && weekendDates(hungary, "en")).toMatch(/^\d+\s?[–-]\s?\d+ \w+/);
  });

  it("shows race day alone when no session is scheduled", () => {
    expect(hungary && weekendDates({ ...hungary, sessions: [] }, "en")).toBe("3 Aug");
  });
});

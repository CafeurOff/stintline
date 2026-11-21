import { describe, expect, it } from "vitest";

import { radio } from "@/test/fixtures/radio";

import { isBoxCall, isUncertain, radioOf } from "./radio";

describe("isBoxCall", () => {
  it.each([
    ["Box box, box this lap.", true],
    ["We are boxing now", true],
    ["Okay, box now.", true],
    ["No, box now.", true],
    ["Don't box, we go to the end.", false],
    ["Do not box this lap", false],
    ["Gap is three seconds", false],
    ["Inbox", false],
    ["", false],
    [null, false],
  ])("reads %j as a box call: %s", (text, expected) => {
    expect(isBoxCall(text)).toBe(expected);
  });
});

describe("isUncertain", () => {
  it("flags spoken text of low confidence only", () => {
    expect(isUncertain({ transcript: "Copy", transcript_confidence: 0.3 })).toBe(true);
    expect(isUncertain({ transcript: "Copy", transcript_confidence: 0.8 })).toBe(false);
    expect(isUncertain({ transcript: "", transcript_confidence: null })).toBe(false);
    expect(isUncertain({ transcript: "Copy", transcript_confidence: null })).toBe(false);
  });
});

describe("radioOf", () => {
  it("keeps one car's messages in order, or everyone's", () => {
    expect(radioOf(radio, 4).map((m) => m.lap)).toEqual([12, 52, 69, 70]);
    expect(radioOf(radio, null)).toHaveLength(radio.length);
    expect(radioOf(radio, 99)).toEqual([]);
  });
});

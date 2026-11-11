import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useDocumentTitle } from "./useDocumentTitle";

describe("useDocumentTitle", () => {
  it("adds the site name after the page title", () => {
    renderHook(() => {
      useDocumentTitle("Drivers");
    });

    expect(document.title).toBe("Drivers · StintLine");
  });

  it("shows the site name alone while the title is unknown", () => {
    renderHook(() => {
      useDocumentTitle(null);
    });

    expect(document.title).toBe("StintLine");
  });
});

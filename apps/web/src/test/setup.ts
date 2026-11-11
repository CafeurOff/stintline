import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

// Pages are lazy-loaded: the first import of a page in a busy parallel run can take
// longer than the default 1 s that find* queries wait.
configure({ asyncUtilTimeout: 3000 });

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

// jsdom has no layout: scrolling is a no-op, and <dialog> lacks showModal/close.
Element.prototype.scrollIntoView = () => undefined;
const dialog = HTMLDialogElement.prototype as Partial<HTMLDialogElement>;
if (typeof dialog.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

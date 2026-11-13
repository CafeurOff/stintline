import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import { renderWithProviders } from "@/test/render";
import { server } from "@/test/server";

import { PdfViewer } from "./PdfViewer";

const page = {
  getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
  render: () => ({ promise: Promise.resolve() }),
};

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: () => ({
    promise: Promise.resolve({ numPages: 2, getPage: () => Promise.resolve(page) }),
  }),
}));
vi.mock("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: "/worker.js" }));

const URL_ = "/api/v1/documents/5/pdf";
const pdf = () => new HttpResponse(new Uint8Array([37, 80, 68, 70]), { status: 200 });

describe("PdfViewer", () => {
  it("draws every page and zooms", async () => {
    server.use(http.get(`*${URL_}`, pdf));
    renderWithProviders(<PdfViewer url={URL_} title="Doc 41" />);

    expect(await screen.findByText("2 pages")).toBeVisible();
    expect(screen.getAllByRole("img", { name: /Page \d of 2/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeEnabled();
    expect(await screen.findByText("2 pages")).toBeVisible();
  });

  it("waits when fia.com asks for a pause, then shows the document", async () => {
    let calls = 0;
    server.use(
      http.get(`*${URL_}`, () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 429, headers: { "Retry-After": "1" } })
          : pdf();
      }),
    );
    renderWithProviders(<PdfViewer url={URL_} title="Doc 41" />);

    expect(await screen.findByText(/ten seconds between requests/)).toBeVisible();
    expect(await screen.findByText("2 pages", {}, { timeout: 4000 })).toBeVisible();
  });

  it("says when the PDF cannot be loaded", async () => {
    server.use(http.get(`*${URL_}`, () => new HttpResponse(null, { status: 502 })));
    renderWithProviders(<PdfViewer url={URL_} title="Doc 41" />);

    expect(await screen.findByText(/could not be loaded/)).toBeVisible();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { routes } from "@/app/router";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { Locale } from "@/lib/i18n/locale";

function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
}

/** Renders the real route tree at `path` with a fresh, retry-free query client. */
export function renderRoute(path = "/", { locale = "en" }: { locale?: Locale } = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <I18nProvider locale={locale}>
      <QueryClientProvider client={client()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  return { ...view, router };
}

/** Renders a component with the providers it needs (no router). */
export function renderWithProviders(ui: ReactNode, { locale = "en" }: { locale?: Locale } = {}) {
  return render(
    <I18nProvider locale={locale}>
      <QueryClientProvider client={client()}>{ui}</QueryClientProvider>
    </I18nProvider>,
  );
}

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { RouterProvider } from "react-router";

import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { type Locale, localePath, pathLocale } from "@/lib/i18n/locale";

import { createQueryClient } from "./queryClient";
import { createAppRouter } from "./router";

/** Loads the current page at its address in the other language. */
function openIn(locale: Locale) {
  const { pathname, search, hash } = window.location;
  window.location.assign(`${localePath(pathname, locale)}${search}${hash}`);
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  const [router] = useState(createAppRouter);
  return (
    <I18nProvider locale={pathLocale(window.location.pathname)} onSwitch={openIn}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>
  );
}

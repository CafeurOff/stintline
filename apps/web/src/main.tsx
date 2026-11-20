import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./app/App";
import { initialLocale } from "./lib/i18n/locale";
import { loadMessages } from "./lib/i18n/messages";

const container = document.getElementById("root");
if (!container) {
  throw new Error("Root element #root not found");
}

// The dictionary request starts as soon as this module runs, in parallel with nothing else
// to wait for: the first render needs it anyway.
void loadMessages(initialLocale()).then(() => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

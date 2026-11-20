/// <reference types="vitest/config" />
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Preloads the Latin Archivo file, the only font of the design (ADR 0023), so titles do not
 * wait for the stylesheet to be parsed before the font request starts. Production build only:
 * the file name carries a content hash.
 */
function preloadArchivo(): Plugin {
  return {
    name: "stintline-preload-archivo",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, context) {
        const file = Object.keys(context.bundle ?? {}).find((name) =>
          /archivo-latin-standard-normal-[\w-]+\.woff2$/.test(name),
        );
        if (!file) return [];
        return [
          {
            tag: "link",
            attrs: {
              rel: "preload",
              href: `/${file}`,
              as: "font",
              type: "font/woff2",
              crossorigin: "",
            },
            injectTo: "head",
          },
        ];
      },
    },
  };
}

/**
 * Starts the reader's dictionary download with the page instead of after the main script runs
 * (`lib/i18n/messages.ts`): a tiny script, placed after the one in index.html that sets
 * `<html lang>`, adds a modulepreload for that language's chunk.
 */
function preloadDictionary(): Plugin {
  return {
    name: "stintline-preload-dictionary",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, context) {
        const files: Record<string, string> = {};
        for (const chunk of Object.values(context.bundle ?? {})) {
          const locale =
            chunk.type === "chunk"
              ? /\/lib\/i18n\/(en|fr)\.ts$/.exec(chunk.facadeModuleId ?? "")
              : null;
          if (locale?.[1]) files[locale[1]] = `/${chunk.fileName}`;
        }
        if (Object.keys(files).length === 0) return [];
        return [
          {
            tag: "script",
            children:
              `(function(){var href=${JSON.stringify(files)}[document.documentElement.lang];` +
              `if(!href)return;var link=document.createElement("link");link.rel="modulepreload";` +
              `link.href=href;document.head.appendChild(link);})();`,
            injectTo: "head",
          },
        ];
      },
    },
  };
}

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss(), preloadArchivo(), preloadDictionary()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    // Flags stay separate files: inlined, the 400 flag-icons SVGs would add 218 kB to the
    // stylesheet every page waits for, while a page shows a handful of them.
    assetsInlineLimit: (file) => (file.includes("flag-icons") ? false : undefined),
    // The only chunk over 500 kB is three.js behind the 3D lap view, loaded on demand (ADR 0021).
    chunkSizeWarningLimit: 1000,
    // Read by the API, which adds a modulepreload of each page's chunk to its head (ADR 0025).
    manifest: true,
    rollupOptions: {
      output: {
        // React, the router and TanStack Query change far less often than our code: in their
        // own chunk, a returning visitor keeps them cached across deploys.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler|react-router|@tanstack)\//.test(id)) {
            return "framework";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/ws": { target: apiTarget.replace(/^http/, "ws"), ws: true },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    // Each test file builds a jsdom and imports the app: reusing the worker's module graph
    // across files halves the CPU time. More than half the cores only adds contention.
    isolate: false,
    maxWorkers: "50%",
    // Page tests render the real route tree with many queries; under coverage and a full
    // parallel run they can take longer than the 5 s default.
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // The 3D scenes and Car3D only render through WebGL, which jsdom lacks: their maths live
      // in track3d.ts, carShape.ts and playback.ts (tested); the scene is checked in a real
      // browser.
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/features/telemetry/Lap3DScene.tsx",
        "src/features/telemetry/Car3D.tsx",
        "src/features/telemetry/CircuitWorld.tsx",
        "src/features/race/components/Race3DScene.tsx",
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});

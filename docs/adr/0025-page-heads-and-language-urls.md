# 0025. Page heads rendered by the API, and one URL per language

- Status: Accepted (option B of the polish audit, taken by the maintainer on 2026-11-20)
- Date: 2026-11-20

## Context
Every page of the web app was the same index.html: the title "StintLine" until the
JavaScript ran, one English description, no canonical address, no language alternates, no
link-preview tags, no structured data. `robots.txt` and `sitemap.xml` returned the app, and an
unknown address answered 200. Search engines run JavaScript, but link previews (Discord, X,
WhatsApp, iMessage) do not: a shared link showed no title or picture. The language was a
stored preference, so the French pages had no address of their own.

## Decision drivers
- A shared link shows the page's title, description and picture.
- Each language has its own address, linked to the other one.
- Real 404s for unknown pages.
- No server rendering of the React tree (cost, double code paths), no new service.

## Options considered
### A. Static pre-rendered heads at build time
- Cons: thousands of pages (every Grand Prix and driver since 1950) and data that changes
  after each race.

### B. The API renders the head into index.html (chosen)
- Pros: the data is already in the API; one small view; the React app is untouched.
- Cons: nginx sends page requests to the API; the API image carries the web build's
  index.html and manifest.

### C. Full server-side rendering (React on Node)
- Cons: a Node service, hydration, and every page written for two environments.

## Decision
- nginx serves files that exist and sends every other path to the API (`location @page`).
  `stintline.seo` describes each route of the router (`pages.py`: title, description, JSON-LD
  `WebSite`, `SportsEvent`, `Person`, `SportsTeam`, `Place`; preview picture of a driver from
  the portrait relay, ADR 0024) and renders the built index.html with it (`document.py`):
  title, description, canonical, `hreflang` en/fr/x-default, Open Graph and Twitter tags,
  `noindex` and status 404 for a page that does not exist. `Cache-Control: no-cache`.
- French pages live under `/fr` (`/fr/drivers/norris`). The web app takes the language from
  the address and mounts the router with the `/fr` basename, so every link keeps its
  language. Switching language loads the other address. On an English address, a reader whose
  stored choice, else browser language, is French is sent to the `/fr` twin before the app
  loads; crawlers have neither and stay on the English page.
- `sitemap.xml` lists every page in both languages with their alternates (cached, rebuilt
  after each import); `robots.txt` allows everything except `/api/`.
- Faster first paint: the head also preloads the page's chunk (`modulepreload`, from Vite's
  build manifest) and the API call the page makes first (`preload as=fetch`), so they start
  with the page instead of after the main script.
- The French Grand Prix names live in one JSON file (`apps/web/src/lib/i18n/event-names.fr.json`)
  read by both the web app and the API.

## Consequences
- The API image is built with the web image as its `web` context
  (`--build-context web=docker-image://…`, `additional_contexts` in the demo compose), so the
  head always points to the asset names nginx serves.
- In development the Vite server serves index.html as before; the API renders pages only where
  nginx sends them (demo, production) and falls back to a bare document without a build.
- A new route in `router.tsx` needs a line in `seo/pages.py` (or it answers 404 from the
  server) and in `seo/document.py` `PAGE_MODULES` (a test checks the modules exist).

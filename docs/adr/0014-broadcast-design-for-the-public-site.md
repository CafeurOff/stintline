# 0014. Broadcast design for the public site

- Status: Superseded by ADR 0016 for its visual rules (2026-11-12). Accepted (maintainer decision, 2026-11-11). Amends the visual rules of ADR 0007 and ADR 0008.
- Date: 2026-11-11

## Context
ADR 0007 made the circuit the interface and banned dashboards, stat tiles, gradients, glows and decorative cards. That fitted a strategy tool. Once StintLine became a public hub for fans (ADR 0008) and the hub pages were built, the maintainer reviewed the site as a visitor and found it unfit for production: too much empty space, a plain navigation bar, a list of Grands Prix that looked like a table, a live page that told visitors to run `make live`, Wikipedia photos where official ones exist, and telemetry charts that could not be zoomed.

## Decision drivers
- Pleasant for casual fans, rich enough for hardcore fans, on a phone as well as a desktop.
- The circuit stays the signature visual.
- No new dependency and zero budget. Official media remain URL references only (ADR 0006).
- Accessibility (contrast, keyboard, text alternatives) must not regress.

## Options considered
### Keep the ADR 0007 rules and only tidy spacing
- Pros: no rule change. Cons: does not answer "too empty" and "too plain"; hub pages need summary figures and visual anchors.

### Magazine style (airy, large photos, editorial typography)
- Pros: elegant. Cons: more empty space, the opposite of the feedback; few freely usable large photos.

### **Broadcast style (television graphics of motorsport)**
- Pros: familiar to the audience, dense by nature (lower thirds, timing towers, countdowns), works with the data we have: team colours, circuit outlines, official portraits. Cons: needs care not to become a cluttered dashboard.

## Decision
Broadcast style, with these rules (they replace the ADR 0007 bans on stat tiles and decorative cards):
- **Frame.** A sticky header with a race-red top line, the italic StintLine wordmark, uppercase sections with a slanted red underline, a live dot, and the next session with a countdown. A phone menu replaces the scrolling link row. A footer carries the site map.
- **Headings.** Page titles are heavy uppercase type with the red slash. Section titles use the same slash (`SectionTitle`).
- **Cards are allowed when they carry data**: team colour as the top border and a solid tint (`teamTint`), the circuit outline as a watermark (`CircuitMark`, from the API's per-circuit `outline`), official portraits (`photo_url`). Pure decoration without data stays banned.
- **Key figures as tiles** are allowed for summaries (countdown, backtest, top three). Detailed numbers stay in quiet tables.
- **No empty columns.** A page column that ends early gets related content (older reports, a season strip) or a sticky chart.
- **Texture.** A thin diagonal stripe texture is allowed on a hero only, at very low opacity. No glows.
- **Public copy.** Pages never show commands or setup instructions. The live page shows a countdown, the weekend in the visitor's time zone and the last replay. Running the live mode is documented in the README.
- **Official portraits by default** wherever a driver has one (`photo_url`: the latest official portrait, else Wikipedia). Report cards keep the Wikipedia photo, which is an editorial picture with its credit on the driver page.
- **Telemetry zoom.** Dragging across the charts (or picking a corner) zooms every trace on that part of the lap, counts gaps from its start, frames the circuit on it and compares the drivers there. The zoom is kept in the URL.

## Consequences
- Positive: denser, more recognisable pages; the circuit outline now appears on every Grand Prix, including the next ones (from their last timed visit).
- Negative / risks: more visual code to maintain; official portraits rely on a third-party CDN (ADR 0006 risk unchanged, the switch still turns them off).
- Follow-ups: apply the same style to the race replay panel and the driver profile results table when they are next touched.

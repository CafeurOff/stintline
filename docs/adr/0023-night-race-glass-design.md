# 0023. Night-race glass design for the whole site

- Status: Accepted (maintainer decision, 2026-11-19). Replaces the visual rules of ADR 0016;
  its frame (icon sidebar, top bar, tiles of real figures, panels) stays.
- Date: 2026-11-19

## Context
The maintainer still did not like the ADR 0016 dashboard and pointed to the look of a popular
phone racing app (dark ground, frosted cards, a coloured glow per team or circuit, cut-out
drivers). A first pilot on the home page followed it closely; the maintainer loved it but
found it too close to the reference, and found the "Our engine" badges ugly. The pilot was
then reworked into a look of our own, validated on the home page, and rolled out everywhere.

## Decision drivers
- Keep what the maintainer liked: dark, rich, photographic, team colours everywhere.
- Never copy another product's signature (typeface, shapes, motifs, layouts).
- Light motion only, nothing that feels generated; accessibility kept.

## Options considered
- Follow the reference app closely (Montserrat, dot grid, top glow, italic giant names, pill
  buttons, 3D extruded circuits, tilted stickers): rejected, too close to a copy.
- **Night-race glass**: the same mood with our own motifs (chosen).

## Decision
- **Ground and cards**: near-black ground, frosted cards (`.glass`: translucent fill,
  hairline edge, lit top edge), radii 20–24 px for cards, `rounded-xl` for buttons.
- **Context colour**: each card can be lit from one corner by a team or circuit colour
  (`.glow` with `--glow`, `--glow-x`, `--glow-y`). Circuits get a fixed accent
  (`lib/accent.ts`). Text in a context colour goes through `readable()` (`lib/colour.ts`).
- **Motifs of our own**: light trails like a long exposure of cars at night (`Trails`), a
  hollow outlined car number, position or code behind a subject (`.watermark`), a tilted
  track map with a car of light lapping it (`TrackMap`).
- **Type**: Archivo only, stretched both ways: expanded and heavy for titles (`.display`),
  condensed and thin for timing figures (`.timing`). Figures are tabular (`.num`).
- **Motion**: blocks rise into place when they scroll into view (`.reveal`, scroll-driven
  where supported), timing figures slide in when they change (`tick`), glints run slowly
  along the trails, a car laps the track map. Everything stops under reduced motion.
- **No engine badges** on public pages: figures from our model are explained on `/model`.
- Building blocks: `components/glass/` (`GlassCard`, `PillSwitch`, `MoreLink`, `IconBubble`,
  `pillPrimary`, `pillGlass`, `Trails`, `TrackMap`), plus the ADR 0016 blocks restyled
  (`Panel`, `Tile`, `KeyFigures`, `PageHeader` as a lit title band).

## Consequences
- Every page shares the tokens in `src/index.css` (dark and light themes).
- Hero bands (home, Grand Prix, driver, team, live, report, not found) follow one recipe:
  glow + trails + watermark + cut-out photo or car, with photos kept clear of the text.
- IBM Plex Mono stays only where code-like alignment matters (`font-mono`).
- Full-length official portraits are cropped into busts (`Bust`) wherever a driver fills a
  card; the technical upgrades sit on the team's own car render with lit, numbered areas.
- Every chart can be zoomed into a dragged box, shows values under the pointer and offers
  +, − and reset buttons (`components/charts/`).

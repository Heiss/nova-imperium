# Interface v2 – design draft

Static mockup of the game interface with the new icon set. Nothing here is used
by the game; it is the reference for the design issue.

- [Übersicht](overview.html) and [Gebäude](buildings.html): open the files in
  a browser. Sample data only. On a phone width (≤ 760 px) the menu is a bottom
  tab bar; `buildings.html#mehr` shows the open „Mehr“ bottom sheet (CSS
  `:target`, no script).
- [Planetentypen](planets.html): the 7 planet types of issue 52 as animated
  planets (surface turns, clouds drift, atmosphere breathes; CSS only, off with
  `prefers-reduced-motion`). Textures in `planets/` are tileable SVGs.
- [design.css](design.css): colours, type and components of the draft. No
  inline styles or scripts, so it fits the Content-Security-Policy of the game.
- `icons/`: the 63 SVG icons as delivered (128 × 128, German `<title>`). The
  mockup uses only icons of content that `src/shared/catalog.ts` knows.
- `fonts/`: Cinzel and EB Garamond as self-hosted WOFF2 (SIL Open Font
  License 1.1, see the `OFL-*.txt` files), so no request leaves the server.
- `screenshots/`: `current-*` is the interface today, `mockup-*` the draft;
  desktop 1280 px full page, phone as the Pixel 7 viewport (412 × 915).
  `mockup-planets-animated.webp` is recorded at 15× speed.

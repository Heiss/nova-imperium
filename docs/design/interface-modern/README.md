# Interface „Modern“ – four UX design studies

Design studies for the owner's request of 2026-11-23 (#388, sub-issue of #236):
rebuild the whole interface; the styling stays (colours, Cinzel/EB Garamond,
icons, planet pictures) **[E]**; navigation, list layout, forms and number walls
of the OGame-like structure go **[E]**. „Modern“ is the rebuild, „Classic“ stays
today's presentation (#236) **[E]**.

Owner decisions of the same day **[E]**: three studies, each in the spirit of
one family of games from the research (browser strategy, 4X/space, mobile
strategy), and a fourth study with the dashboard as entry point and the star
map instead of a menu. The density „kompakt“ shows only pictures; a click opens
an info page with the build command; the costs are coloured by whether the
resources are there. The first study (seven areas, rows) is replaced.

Every study shows the same core flow on desktop (1280 × 720) and phone
(390 × 780): entry, building (with the compact mode), sending a fleet, map,
reports. Everything not marked **[E]** is a proposal **[V]**; names and numbers
are examples.

| Study                   | File                       | Idea                                                                                                                                                    |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A – Browser-Strategie   | `a-browser-strategie.html` | The world is the place: buildings around the planet with state bubbles, quick bar, strip of worlds, mission lists (Travian, Forge of Empires, Grepolis) |
| B – 4X / Weltraum       | `b-weltraum-4x.html`       | The map is the workspace: dock, outliner, windows, alerts, orders on the map (Stellaris, EVE Online, Endless Space 2)                                   |
| C – Mobile Strategie    | `c-mobile-strategie.html`  | Base and thumb: skyline of buildings, two corner buttons, build menu over the base, fleet recipes (Clash of Clans, Rise of Kingdoms)                    |
| D – Dashboard und Karte | `d-dashboard-karte.html`   | Dashboard of what the others do, star map as the menu, small menu, chat bottom right, tracker at the bottom (owner's idea)                              |

Other files:

- `screenshots/` – `a1.jpg` … `d5.jpg` (desktop steps) and `a-phone.jpg` …
  `d-phone.jpg` (phone row of each study)
- `before/` – today's interface on `main` (desktop and phone), test data,
  2026-11-23
- `research.md` – the research behind the studies, with sources and limits
- `modern.css`, `studies.css` – the studies' CSS on top of `/style.css`
  (classes `m-` and `k-`)
- `render/` – the Python generator (`python3 render/build.py`, then
  `prettier --write`)

The HTML files reference `/style.css`, `/fonts/`, `/icons/` and `/planets/`
absolutely: serve them from a root that holds `src/client/static/` with this
folder beside it, or look at the screenshots.

Limits: the research could read only search-result excerpts (see
`research.md`); no usability test with players was done; the 3D/planet
pictures are the game's own textures, not new art.

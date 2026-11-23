# Interface „Modern“ – UX design study

Design study for the owner's request of 2026-11-23: rebuild the whole interface
while the styling stays (colours, Cinzel/EB Garamond, icons, planet pictures)
**[E]**, and replace the OGame-like structure: navigation and page structure,
equally weighted list rows, multi-page forms, number walls **[E]**. The rebuild
defines „Modern“; „Classic“ stays today's presentation and can be switched
(#236) **[E]**. Everything else is a proposal **[V]**; names and numbers are
examples. Parent issue: Interface v3 (#236).

Files:

- `01-navigation.html` – seven areas instead of seventeen pages, the shell with
  header (storage „voll in“, energy deficit, planet switch with state), rail with
  „Läuft“, the overview of #236, the phone with „Mehr“
- `02-bauen.html` – buildings, research, shipyard, defense as one catalogue
  grouped by state (now / soon / locked), costs as have/need bars, inspector
- `03-flotte.html` – fleet dispatch on one screen with live preview, presets
  („Vorlagen“), movements as a timeline
- `04-karte.html` – star map with inspector and layers, the list as an equal
  view (#160 decisions kept)
- `05-berichte.html` – reports and messages: „Seit deinem Besuch“, report cards
  with losses as bars, compact spy report
- `06-imperium.html` – all colonies at a glance, production and energy as bars
  (conflict with #243 noted)
- `07-gemeinschaft.html` – ranking with change and trend, guild as a situation
  view, friends
- `08-verwaltung.html` – options with sections and search, admin „Lage“,
  Lexicanum and sign-in on the phone
- `screenshots/` – PNG of every page (1340 px wide)
- `before/` – today's interface on `main` (desktop and phone), taken with test
  data on 2026-11-23
- `research.md` – the research behind the proposals (browser strategy, 4X/space,
  mobile strategy), with sources and limits
- `modern.css` – the study's CSS on top of `/style.css`; every class starts with
  `m-`
- `render/` – the Python generator of the pages (`python3 render/build.py`,
  then `prettier --write`)

The HTML files reference `/style.css`, `/fonts/`, `/icons/` and `/planets/`
absolutely: serve them from a root that holds `src/client/static/` with this
folder beside it, or look at the PNGs.

Limits: the research could read only search-result excerpts, not the pages
themselves (see `research.md`); no usability test with players was done.

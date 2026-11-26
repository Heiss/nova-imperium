# Interface „Modern“ – the design after the playtest

The design of the interface „Modern“ for #388 (sub-issue of #236), as the
owner decided it in the UX playtest of 2026-11-23. It is a design study,
not built. **[E]** marks an owner's decision, **[V]** a proposal; names and
numbers are examples. The record of every pick, with the owner's words, is
`okf/features/ux-playtest.md`; the playtest page is `playtest/index.html`.

Starting point **[E]** (owner, 2026-11-23): the styling stays (colours,
Cinzel/EB Garamond, icons, planet pictures); the navigation, the list layout,
the forms and the number walls of the OGame-like structure go. „Modern“ is
the rebuild, „Classic“ stays today's presentation (#236). The game must be
playable on the phone and on the desktop: mobile first, the desktop derived
from it **[E]**. The owner mostly plays on the desktop, in visits of 2–10
minutes **[E]**.

## Animations (desktop)

Four animations, MP4 1920 × 1148 at 24 frames per second and smaller GIFs.
The bar under each picture explains the step; it is not part of the
interface. Source: `render/anim_desk.py`.

| Imperium (20 s)                         | Brut (20 s)                     | Ewige (20 s)                      |
| --------------------------------------- | ------------------------------- | --------------------------------- |
| ![Imperium](playtest/anim/imperium.gif) | ![Brut](playtest/anim/brut.gif) | ![Ewige](playtest/anim/ewige.gif) |
| [MP4](playtest/anim/imperium.mp4)       | [MP4](playtest/anim/brut.mp4)   | [MP4](playtest/anim/ewige.mp4)    |

The three races run the same flow: the alert in the Lage line → the Lage
sheet with the timeline → the system window → drag Aurelia onto Nox → the
target window with „Verlegung“ and the preset „Alles“ → the fleet in the
line and the timeline. Only the frames and the terms change.

The run through the whole loop in the Imperium, 94 s
([MP4](playtest/anim/durchlauf.mp4)), as GIF in four parts:

1. „Willkommen zurück“ → mouse wheel into system 1:27 → building on Aurelia
   → espionage on Varn → the target window with the preset „Raubzug“ → time
   skip. ![Part 1](playtest/anim/durchlauf-1.gif)
2. The victory in the Lage line → the report as a table → the tab „Herold“
   with only a preview of the Kriegsbericht.
   ![Part 2](playtest/anim/durchlauf-2.gif)
3. The Kriegsbericht in the big window, full screen and back (a sketch; the
   real replay is the Godot idea of #382).
   ![Part 3](playtest/anim/durchlauf-3.gif)
4. „Du bist am Zug“ → the siege overview → the board with the planner
   window → „Züge abschicken“ (#155).
   ![Part 4](playtest/anim/durchlauf-4.gif)

## The frame

### Phone

| Start                                | Lage sheet pulled up                | Menü                              |
| ------------------------------------ | ----------------------------------- | --------------------------------- |
| ![Start](playtest/final/gv-gv-a.jpg) | ![Lage](playtest/final/gv-gv-b.jpg) | ![Menü](playtest/r7/r7-s19-a.jpg) |

- **Start:** the galaxy as a map of systems; each occupied position is a
  small mark on a ring around the star **[E]** (s1m). The galaxy overview is
  the start; windows are not restored at the login **[E]** (d2).
- **Colour language [E]** (sc): each group has a colour and a shape – du
  blue circle, Freunde pink diamond, Gilde green square, Feinde red
  triangle, andere grey circle. The options offer colour sets (colour
  blindness, red-green weakness) and „only circles“.
- **Names on tap [E]** (s1n). The legend can be minimized to a very small
  hint tab at the right edge **[E]** (gv).
- **Zoom levels [E]** (sg): universe › galaxy › system; a switcher and
  swiping between galaxies, with the option „nur wischen“ or no swiping;
  2–3 galaxies, the design must not depend on the number.
- **The Lage sheet [E]** sits at the bottom everywhere and can be pulled up
  and down. Pulled down it is one line with the most urgent item and the
  time left; a tap opens it; no button, but a hint that it can be tapped
  (s2r). With nothing urgent the line rotates slowly through the events.
  Pulled up it has the tabs Zeitleiste · Funk · Herold · Berichte (s2m,
  s12, s13); the timeline runs from the past over „JETZT“ into the future.
- **Context [E]** (s8): on the phone the sheet is context-sensitive; an
  overview shows general information, a tap on a thing its own information
  and actions.
- **Tab bar [E]** (s17–s19): Karte · Welten · Flotten · Berichte · Menü; the
  menu (Lexikon, Soziales, Optionen, Admin) opens as the sheet; pulling it
  down or tapping the map closes it.

### Desktop

| Start                             | Lage sheet pulled up, a system window |
| --------------------------------- | ------------------------------------- |
| ![Start](playtest/desk/start.jpg) | ![Lage](playtest/desk/lage.jpg)       |

- **Layout [E]** (d9): left the own worlds, right knowledge (Lexikon), top
  the menu, bottom information and communication (the Lage sheet), the map
  in the middle as the main view (d8).
- **Worlds [E]** (d8): a slim strip on the left with every world, its
  resources and its state; a click opens the world's surface as a window,
  with „Direkt zur Welt“ to jump there on the map.
- **Lexikon [E]** (gv): hidden; a narrow vertical tab „Lexikon“ at the right
  edge slides it out over the map; a pin docks it beside the map; it stays
  collapsible.
- **Menu [E]** (d9): a drop-down under „Menü“ at the top.
- **The Lage sheet [E]** (d1, d5, d7): centred with a fixed width (about
  400–440 px), two fixed heights (the one line, and fully up), it scrolls
  inside; on the desktop it shows the same information everywhere.
- **Windows [E]** (d1–d5): system, world, research, fleet and report
  windows over the map, several at once and independent of each other; they
  can be minimized and pinned; a pinned window is a favourite stored on the
  server; after a login all pinned windows are minimized, so the galaxy is
  in view. Where minimized windows sit is open **[V]** (a small row at the
  top of the map).
- **Mouse [E]** (d1, d8): click, not hover; the mouse wheel zooms through
  universe › galaxy › system; dragging a world from a system window onto a
  system opens a target window; with two system windows open the world can
  be dropped straight onto a world in the other one (d2).
- **On the map [E]** (d6, d10): the Börse icon at the top right; the map
  layer „Gilde“. No chat bubble: the chat is the tab „Funk“ (the desktop
  mockups d1–d7 still showed one by mistake).

## The views

| Topic         | Decision                                                                                                                                                                                                                                                                                                                 | Phone                                      | Desktop                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------- |
| Own system    | Orbits with the worlds; free positions as dashed rings to pick a colony; the position in the system matters for the choice **[E]** (s1s, s11)                                                                                                                                                                            | ![Own system](playtest/r4/r4-s11-a.jpg)    | ![Own system](playtest/desk/system.jpg)           |
| Building      | Drag a building onto a field, or tap the building and then the field; every field shows its yield; „Bestätigen“ builds **[E]** (s3, needs #158). Desktop: the surface as a window, the info page as a second window **[E]** (d3)                                                                                         | ![Building](playtest/r1/r1-s3-c.jpg)       | ![Building](playtest/desk/bauen.jpg)              |
| Info page     | Compact mode: a big sheet with picture, one sentence of effect, costs coloured by whether the resources are there; standard mode: its own page with tabs and the levels; „Schaltet frei“ only there **[E]** (s4)                                                                                                         | ![Info page](playtest/r1/r1-s4-c.jpg)      |                                                   |
| Research      | A tree of all researches; with a goal only its path is highlighted; a prerequisite needed at different levels appears once per level **[E]** (s5, d4). Desktop: the tree and the goal as two windows                                                                                                                     | ![Research](playtest/r2/r2-s5-b.jpg)       | ![Research](playtest/d4/d4-d4-b.jpg)              |
| Defense       | One installation large, drag the amount, resource bars and a timeline up to the attack **[E]** (s6)                                                                                                                                                                                                                      | ![Defense](playtest/r2/r2-s6-b.jpg)        |                                                   |
| Espionage     | From the system view: the world shows the age of its report and sends spy skulls; the report opens in the world's sheet or window and is reachable from the timeline, the report list and the world **[E]** (s7, s8)                                                                                                     | ![Espionage](playtest/r3/r3-s8-a.jpg)      | ![Espionage](playtest/desk/spionage.jpg)          |
| Fleet         | A tap on a world opens the presets (saved per player); dragging a route on the map opens the same; the ship-by-ship choice stays **[E]** (s9). Desktop: everything in the target window, several fleet windows **[E]** (d5)                                                                                              | ![Fleet](playtest/r3/r3-s9-c.jpg)          | ![Fleet](playtest/desk/raubzug.jpg)               |
| Battle        | The report is a table; the battle stands in the timeline and one click opens the report **[E]** (s10). Desktop: the report as a window, several at once **[E]** (d7)                                                                                                                                                     | ![Battle](playtest/r3/r3-s10-a.jpg)        | ![Battle](playtest/desk/kampfbericht.jpg)         |
| Kriegsbericht | The replay comes from the Herold; every battle has one, visible only to attacker and defender; public only when the Herold researched it or a player leaked it („Durchstechen“) **[E]** (s10). The Lage sheet shows only a preview; the whole plays only in a window with full screen **[E]** (d6, after the animations) |                                            | ![Kriegsbericht](playtest/desk/kriegsbericht.jpg) |
| Herold        | Its own newspaper page and the tab „Herold“ in the Lage sheet with the newest Kriegsbericht and „Durchstechen“; news about the player also in the timeline **[E]** (s13, d6)                                                                                                                                             | ![Herold](playtest/r4/r4-s13-c.jpg)        | ![Herold](playtest/desk/herold.jpg)               |
| Guild         | The chat is the tab „Funk“ **[E]** (s12); members are always highlighted in their colour on the map, their details only in the layer „Gilde“ **[E]** (d10)                                                                                                                                                               | ![Guild](playtest/r4/r4-s12-b.jpg)         | ![Guild](playtest/d10/d10-d10-c.jpg)              |
| Börse         | „Tauschen“ in the sheet **[E]** (s14); a map layer with the offers behind the icon at the top right, a list in the menu **[E]** (d6)                                                                                                                                                                                     | ![Börse](playtest/r4/r4-s14-b.jpg)         | ![Börse](playtest/d6/d6-d6-c.jpg)                 |
| Away and back | „Willkommen zurück“ in the sheet: counts since the last visit and „Jetzt tun“ **[E]** (s15)                                                                                                                                                                                                                              | ![Away and back](playtest/r4/r4-s15-a.jpg) |                                                   |
| Siege         | The siege opens with its overview (phase, Nachschub, damage, troops); the board behind a button fills the screen; moves can be planned on the phone **[E]** (s16). The planner sits in the sheet on the phone and is a window on the desktop **[E]** (after the animations)                                              | ![Siege](playtest/r5/r5-s16-b.jpg)         | ![Siege](playtest/desk/bodenkampf.jpg)            |
| Welten        | Phone: one card per world with its picture, what runs and the main hint; inside a world, swiping goes to the next (option: picker, picker and swipe, swipe only) **[E]** (s17). Desktop: the strip on the left (d8)                                                                                                      | ![Welten](playtest/r7/r7-s17-a.jpg)        | ![Welten](playtest/d8/d8-d8-b.jpg)                |
| Berichte      | A list by time with filters (Kampf, Auspex, Flotte, Lieferung); today's limit per player stays **[E]** (s18). Desktop: a tab of the Lage sheet, the report as a window **[E]** (d7)                                                                                                                                      | ![Berichte](playtest/r7/r7-s18-a.jpg)      | ![Berichte](playtest/d7/d7-d7-b.jpg)              |

Mission names are the catalogue's: Sturmangriff, Auspex-Erkundung,
Versorgungsflug, Verlegung, Wache stellen, Bergung, Landnahme, Expedition,
Raketenangriff, Mondbruch, Vermessung.

## The races

The races themselves are #154 (v3). For the interface **[E]**: a race lives
only in the frames – the borders and large surfaces (top bar, Lage sheet,
windows, world strip); never over the map and never on the controls;
motion only in the frames; the option „Animationen“ (it exists today, per device) stops it. The
frames look the same on the desktop and the phone (gv); the layout stays
the same for every race.

| Race     | Frames                                                                                                                                                                                             | Terms                                                                              | Phone                                          | Desktop                              |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------ |
| Imperium | Today's styling with plastic gold strips, golden ornaments (pointed arches) and a small gleam that runs over the gold now and then **[E]** (imperium8, gv)                                         | today's                                                                            | ![Imperium](playtest/final/final-imperium.jpg) | ![Imperium](playtest/desk/start.jpg) |
| Brut     | Calm, dark purple-brown chitin in lit relief, thin borders, viscous slime drops and strands, ribs hanging from the top bar, small bone spurs on the sheet; reacts to nothing **[E]** (brut3–brut7) | Brutstätten, Nest, Schwärme, Spuren, Witterung (Lage), Jagdgrund (Galaxie) **[V]** | ![Brut](playtest/final/final-brut.gif)         | ![Brut](playtest/desk/brut.jpg)      |
| Ewige    | Dark bronze double frames with 65° corners, engraved notches and a glowing gem that changes its colour on events **[E]** (ewige3, ewige8)                                                          | Sternkarte, Welten, Flotten, Chronik, Zeitlauf (Lage), Kreis (Galaxie) **[E]**     | ![Ewige](playtest/final/final-ewige.gif)       | ![Ewige](playtest/desk/ewige.jpg)    |

Inspiration only, own shapes (StarCraft II's Zerg and Protoss, research
notes in `okf/features/ux-playtest.md`).

## What today's game already carries

Analysis of 2026-11-23 against `main` (79ea93c), **[V]**: how much of the
Imperium design works without new game features. Four groups.

**1. Only the interface changes; the data and the rules exist.**

- The galaxy map with its marks, names on tap and the zoom universe ›
  galaxy › system: the state already carries every planet with owner,
  coordinates and activity (`src/server/game/state.ts`, `galaxyOf`); a round
  has 1–9 galaxies, 2 by default (`src/core/universe.ts`).
- The groups du, Freunde (`friends.ts`), Gilde (`guilds.ts`) and andere.
- The Lage line: the overview cards already compute „Achtung“ (attacks on
  the way, too little energy), „Läuft“ and „Bereit“
  (`src/client/logic/overview-cards.ts`); the most urgent item comes from
  there. The timeline: fleets, build and research queues, reports and
  messages are in the state.
- The tabs Funk (the guild chat exists; how private messages appear is
  open) and Berichte (reports with today's limit per player).
- Welten with resources and what runs; building in a world window without
  fields; the compact info page (Lexicanum).
- The research tree with the path to a goal (the requirements are in
  `src/core`); defense; espionage with the report at the world.
- Fleets in the target window with every mission of the catalogue, presets
  aside (group 2); dragging a world onto a system; a colony on the free
  rings.
- The battle report as a table (`BattleReport.svelte`).
- Guild members in their colour on the map, with their activity
  (`activity.ts`); „Wache stellen“ (`holding.ts`).
- „Tauschen“ as today's Marktplatz (#171, exchange with the server) in the
  sheet and in the menu.
- Push: a click already opens a view (`src/client/static/push-worker.js`,
  `/?view=`).
- The menu, the Lexikon sidebar (Lexicanum), the options page.
- The Imperium frame (gold strips, ornaments, gleam): styling only.

**2. Small technical additions, no new game rules.**

- Fleet presets saved per player **[E]** (s9): a store on the server.
- Pinned windows as favourites on the server **[E]** (d5): a store.
- New options: colour sets, shapes on or off, the
  swipe options, a docked Lexikon.
- A push that opens the exact world or report (today: only a view).
- „Willkommen zurück“: the read marker of the reports exists (`readAt`);
  the time of the last visit does not.
- Any replay of a battle: a report stores only the number of rounds
  (`src/server/game/fight.ts`), not what happened in each round.

**3. Needs a new feature (its own issue); without it the part drops or falls back.**

| Part of the design                                    | Feature                                             | Without it                                         |
| ----------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------- |
| Building on fields with yields                        | #158 fields and neighbour bonuses                   | Building in the world window, no fields, no yields |
| Siege, ground combat, battalions, new research, units | #155                                                | Drops                                              |
| Herold page, tab „Herold“, Kriegsbericht, leaking     | #382 (with the research „Schweigegelübde“)          | Drops; the tab bar of the sheet loses „Herold“     |
| Börse offers on the map, delivery by cargo fleet      | #386                                                | Today's Marktplatz                                 |
| Brut and Ewige frames                                 | #154                                                | Only the Imperium                                  |
| The group Feinde                                      | no war or diplomacy in the game today               | Open (see below)                                   |
| What guild members do (who holds, who spies)          | a player sees only fleets coming to the shown place | Only membership and activity                       |
| Queues through a research; spying on several targets  | #391, #392                                          | Drops                                              |

**4. Existing features without a „Modern“ design yet.** The playtest
covered the loop, not every page: Highscore, Errungenschaften, private
messages (inbox, writing), friends, guild management (ranks, profile,
switch), the round archive and the round report, Endzeit, Expedition, moons
(Mondzitadelle, Mondbruch), Phalanx, jump gate, Raketenangriff,
Verbandsangriff, Bergung (only a button so far), demolition, giving up a
colony, renaming, vacation mode, Vermessung, „Meine Aktivität & Spielzeit“, the level
overview, the admin pages, login, passkeys and install, „Problem melden“,
„Neuigkeiten“.

## Open decisions

- Where minimized pinned windows sit (proposal: a small row at the top of
  the map).
- The period over which attacks make a player a Feind. **[E]** (owner,
  2026-11-23): the group comes from today's data – who attacked the player
  and whom the player attacked.

Decided **[E]** (owner, 2026-11-23): what needs a feature of group 3 is left
out of a first „Modern“ and comes with its feature (the Lage sheet has three
tabs without „Herold“, building without fields, „Tauschen“ is today's
Marktplatz, no siege); the small additions of group 2 belong to the rebuild,
presets and pins stored on the server; the pages of group 4 get more
playtest rounds.

## History

### The four first studies (A–D)

Before the playtest, four studies showed the same core flow on desktop
(1280 × 720) and phone (390 × 780), each in the spirit of one family of games
from the research below **[E]**. The owner liked the mobile-first study (C)
best; the playtest started from there.

| Study                   | File                       | Idea                                                                                                                                                    |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A – Browser-Strategie   | `a-browser-strategie.html` | The world is the place: buildings around the planet with state bubbles, quick bar, strip of worlds, mission lists (Travian, Forge of Empires, Grepolis) |
| B – 4X / Weltraum       | `b-weltraum-4x.html`       | The map is the workspace: dock, outliner, windows, alerts, orders on the map (Stellaris, EVE Online, Endless Space 2)                                   |
| C – Mobile Strategie    | `c-mobile-strategie.html`  | Base and thumb: skyline of buildings, two corner buttons, build menu over the base, fleet recipes (Clash of Clans, Rise of Kingdoms)                    |
| D – Dashboard und Karte | `d-dashboard-karte.html`   | Dashboard of what the others do, star map as the menu, small menu, chat bottom right, tracker at the bottom (owner's idea)                              |

### The playtest

One situation at a time with three variants without labels; the owner
picked, wrote a note and answered a question; rounds on the phone (s1–s19),
on the desktop (d1–d10), for the races (Brut, Ewige, Imperium) and a check
of the whole picture (gv). Every pick with the owner's words is in
`okf/features/ux-playtest.md`.

### Files

- `playtest/` – the playtest page (`index.html`), the queue (`queue/`), the
  pictures of every round (`r1/` … `r7/`, `d1/` … `d10/`, `race*/`), the
  whole picture (`final/`), the desktop stills (`desk/`) and the animations
  (`anim/`)
- `screenshots/` – the steps of the studies A–D; `before/` – today's
  interface on `main` (2026-11-23)
- `modern.css`, `studies.css` – CSS on top of `/style.css` (classes `m-` and
  `k-`)
- `render/` – the Python generators (`build.py` for A–D, `playtest_*.py` for
  the rounds, `anim_desk.py` for the animations)

The HTML files reference `/style.css`, `/fonts/`, `/icons/` and `/planets/`
absolutely: serve them from a root that holds `src/client/static/` with this
folder beside it, or look at the pictures.

Limits: no usability test with players beyond the owner; the research could
read only search-result excerpts; the planet pictures are the game's own
textures; the Kriegsbericht and the board are sketches.

## Research

Research date: 2026-11-23. Scope: input for restructuring Nova Imperium's OGame-like UI (navigation, catalogue lists, fleet dispatch, galaxy, reports, number walls). Visual identity (gold/bronze, Cinzel/EB Garamond, icons, planet images) is out of scope.

### Method and limits

- Sources were found with web search. **Full-page fetching was blocked in this session** (every host failed DNS in the sandbox), so each VERIFIED claim comes from the **search-result excerpt of the cited page**, not from reading the whole page. Treat details as "as quoted in the source excerpt".
- **VERIFIED** = stated in the cited source (excerpt). **INFERRED** = my reasoning; not stated by a source.
- Some games have very little public UI documentation (Homeworld 3, EVE Echoes, Rise of Kingdoms march/mail screens). Gaps are listed explicitly; nothing was filled in from memory.
- UIs change. Dates are given where the source had one.

---

### 1. Per-game findings

#### 1.1 OGame (Gameforge, browser, since 2002)

- **Premium overview tools.** The "Commander" officer unlocks a construction queue of up to 5 buildings (the queue is cleared if resources are missing when an item reaches the top), the "Empire view" (one page with resources and infrastructure of all planets and moons), message filtering and an improved galaxy view. It gives no direct gameplay bonus, only better UI. VERIFIED: https://ogame.fandom.com/wiki/Commander , https://ogame.fandom.com/wiki/Construction_Queue (fan wiki).
- **Fleet dispatch is multi-step.** An open-source re-implementation documents dispatch as several UI pages. Players have asked for a one-page dispatch since at least 2010, and Gameforge had received suggestions to merge pages 2 and 3. No official source found that the live game merged them. VERIFIED: https://deepwiki.com/ogamespec/ogame-opensource/3-fleet-management-and-combat , https://board.origin.ogame.gameforge.com/index.php/Thread/1169-Sending-fleet-with-one-window/ . Community scripts still target "fleet page 2/3": https://userscripts-mirror.org/scripts/show/95547 .
- **Reports (2024).** Version 11.15.0 (7 May 2024) shows espionage reports in a compact form until clicked and added a filter system to the espionage tab. Players complained that the new view hides whether the target is a moon or a planet and that the expanded view could not be turned back on; add-on makers (OGame Infinity, OGame Ninja) had to rebuild their spy tables. VERIFIED: https://forum.origin.ogame.gameforge.com/forum/thread/188-may-7-version-11-15-0/ , https://board.en.ogame.gameforge.com/index.php?thread%2F845175-version-11-15-0-is-emblematic-of-modern-ogame-s-constant-attempts-to-worsen-play%2F= , https://forum.origin.ogame.gameforge.com/forum/thread/104-ogame-infinity/ .
- **Third-party tables fill gaps.** "O-Table", an advanced spy-report table, is an officially tolerated tool. VERIFIED: https://board.origin.ogame.gameforge.com/index.php/Thread/8884-O-Table-Advanced-spy-report-table/ . INFERRED: players wanted sortable, comparable report data that the base UI did not give.
- **Mobile app.** Changelogs mention a bottom menu (a later version added an indicator of the active tab), a fleet-movement screen with countdowns, sorting by next event (fixed from "return time"), coordinates and planet names on all movements. The App Store notes say the fleet-movement bar under the resources was redesigned "with icons and colors". VERIFIED: https://board.us.ogame.gameforge.com/index.php?thread%2F103706-ogame-mobile-release%2F= , https://apps.apple.com/az/app/ogame/id1593395507 . The developers told Space.com they are "working on a design overhaul of the app" (search excerpt only; page not reachable): https://www.space.com/entertainment/space-games/ogame-developers-explain-how-the-browser-based-sci-fi-game-has-lasted-24-years-ahead-of-the-huge-orion-update .
- **Lifeforms (2022)** added four species with 18 technologies each and two resources, the first big content expansion in ~10 years. VERIFIED: https://cerebral-overload.com/2022/04/the-long-running-mmo-ogame-is-receiving-a-major-expansion-and-coming-to-mobile-this-summer/ .
- **Not verified:** the exact current desktop menu list, galaxy table columns, and any official one-page dispatch. The left-menu / one-page-per-category structure is taken from the task description, not from a source.

#### 1.2 Travian Legends (Travian Games, browser + companion app)

- **Central village overview (Travian Plus, premium).** Tabs for overview (queued buildings per village, troops in training), resources per village plus total and merchants, warehouse (capacity and time until full/empty, negative crop in red with a starvation countdown), culture points, troops. VERIFIED: https://support.travian.com/support/solutions/articles/7000062844 . A newer "Training" tab shows queue lengths of all training buildings across villages: https://unofficialtravian.com/2025/01/travian-legends-6-years-of-changes-at-a-glance/ (community site, Jan 2025).
- **Queues are premium.** Plus adds a waiting loop for building/research and troop movements on the map; Gold Club adds report archive; "Master Builder" queues constructions even when resources are missing. VERIFIED: https://support.travian.com/support/solutions/articles/7000061561 .
- **Presets for repeated dispatch: farm lists.** Named list per sending village, targets with stored troop counts, import from recent raids, "start all" with one click or only selected entries, deactivate entries, auto-scout if only scouts are set. 2023 rework: duplicate entries; lists of lost villages move to "abandoned". VERIFIED: https://support.travian.com/en/articles/69-farm-lists , https://blog.travian.com/2023/01/quality-of-life-vol-3-start-all-button-and-abandoned-farmlists , https://blog.travian.com/2023/10/quality-of-life-farm-list-rework .
- **Reports.** Filters by type (attack, defence, scouting) and by player/village; "delete all" respects the filter (patch 144.5, 29 Apr 2025); opening the combat simulator from a report preselects raid/attack. Alliance tab shows alliance incoming/outgoing attacks. VERIFIED: https://support.travian.com/en/articles/58-reports , https://support.travian.com/en/support/solutions/articles/7000093542-144-5-better-reports-deletion-and-combat-simulator-29-apr-2025- .
- **Undo window.** Oct 2024: cancel troop training within 90 s for a full refund; remove a village from all farm lists from its detail view with a confirmation. VERIFIED: https://www.travian.com/us/news/2024/10/17/travian-legends-october-2024-quality-of-life-updat/ .
- **Shortcuts.** "Quicklinks" buttons; sources disagree on whether they are free or Plus-only. VERIFIED (conflict): https://support.travian.com/en/support/solutions/articles/7000091779-quicklinks .
- **Mobile.** The app is built for smartphones; tablets should use the browser. A designer describes it as a companion app for commuting/AFK play. VERIFIED: https://support.travian.com/en/articles/207-getting-the-travian-legends-mobile-app , https://marioveltri.com/item/2xkYHnyQDXvAfdiEnD3zHF .
- **Alerts.** Special servers have alliance attack notifications. VERIFIED: https://support.travian.com/support/solutions/articles/7000082344 .

#### 1.3 Forge of Empires (InnoGames, browser + mobile)

- **City-builder, not menu-builder.** Building happens from a "Build Menu" into the city view; mobile has a collapsible menu on the right for features not always visible. VERIFIED (page is old, ~2017): https://en.wiki.forgeofempires.com/index.php?title=Interface .
- **Modes on mobile.** Building modes have 3 buttons on mobile (no cancel); pressing the mode button again closes it. VERIFIED: https://forgeofempires.fandom.com/wiki/Building_Modes .
- **"What happened" log.** Event History lives under Town Hall > News > Event History, with a filter button; the Town Hall remembers the last tab. VERIFIED: https://support.innogames.com/kb/ForgeOfEmpires/en_DK/4278 .
- **List hygiene.** Release notes: building menu order no longer changes on each login; with an Upgrade Kit, buildings that cannot be upgraded are faded out; push notifications can be disabled per production type. VERIFIED (search excerpts of InnoGames release notes; exact page per note not pinned): https://support.innogames.com/kb/ForgeOfEmpires/en_DK/4278 and the release-note index https://devtrackers.gg/forge-of-empires/patch_notes .

#### 1.4 Grepolis (InnoGames, browser + app)

- **Queue per city lives in a building.** The Senate shows the build queue with remaining time, allows cancel and gold speed-up. VERIFIED: https://wiki.en.grepolis.com/wiki/Senate .
- **City switch.** Click on the city name in the top bar opens the city list; city overview opens without moving the map. VERIFIED: https://wiki.en.grepolis.com/wiki/The_Map , https://support.innogames.com/kb/Grepolis/en_DK/3539 .
- **Empire overviews are premium.** The Administrator adds 5 extra build-queue slots, resource/troop/trade/culture/city overviews, a quick bar, and the attack planner (plans sortable by city, departure, arrival; attacks are still sent manually). VERIFIED: https://support.innogames.com/kb/Grepolis/en_DK/3539 , https://wiki.en.grepolis.com/wiki/Guide:Attack_Planner .
- **App.** With Administrator, the city list shows resources and current construction/recruitment per city; construction queue via a hammer icon. VERIFIED: https://wiki.en.grepolis.com/wiki/Grepolis_App . Notifications need a login at least every 24 h to stay reliable. VERIFIED: https://support.innogames.com/kb/Grepolis/en_DK/423 .

#### 1.5 Tribal Wars / Die Stämme (InnoGames, browser + app)

- **Village overview** shows buildings, production, troops and troop movements on one page; premium adds production details, merchants and warehouse-full time, a larger building queue and a larger map. VERIFIED: https://support.innogames.com/kb/TribalWars/en_DK/2960 , https://support.innogames.com/kb/TribalWars/en_DK/1296 .
- **Account Manager** (second premium tier, aimed at 5+ villages) automates recruitment and offers custom attack notifications. VERIFIED: https://support-admin.innogames.de/kb/TribalWars/en_DK/1297?ls=1 .
- **Push** depends on in-game settings, OS permission and battery optimisation; App Store reviews report unreliable alerts. VERIFIED: https://support.innogames.com/kb/TribalWars/en_DK/5989 , https://apps.apple.com/gb/app/tribal-wars/id435365767 .
- **Not verified:** a combined all-villages troops/production screen (none found).

#### 1.6 Stellaris (Paradox, PC 4X)

- **Map-first with a persistent side list.** The Outliner (right side) tracks planets, fleets, civilian ships and more. VERIFIED: https://www.cgmagonline.com/review/game/stellaris-pc-review/ . PC Gamer (Jan 2017) credits OS conventions (right-click menus, loading bars) for its approachability: https://www.pcgamer.com/why-i-love-stellaris-slick-interface/ . Players repeatedly ask for a better outliner (DD #154 thread, Sept 2019): https://forum.paradoxplaza.com/forum/developer-diary/stellaris-dev-diary-154-ux-design-in-stellaris.1244013/page-6 .
- **Alerts.** Top-bar alerts: square ones stay until the condition changes or are dismissed; round ones vanish after a short time; alert types can be disabled. VERIFIED (wiki excerpt): https://stellaris.fandom.com/wiki/Main_interface .
- **Situation Log redesign (DD #417, 23 Apr 2026, 4.4 "Pegasus").** Entries sorted into collapsible categories, high-volume entries grouped into "Findings", pin to a "Priority" category. VERIFIED (secondary summary): https://forum.paradoxplaza.com/forum/developer-diary/stellaris-dev-diary-417-situation-log-updated.1918530/page-6 , https://soren.com/en/news/stellaris/2026-04-23-stellaris-overhauls-situation-log-in-44-pegasus .
- **Fleet Manager and templates (DD #98, 2.0).** Lists all fleets; templates store designs and counts; one-click reinforce from manager or fleet view. VERIFIED: https://admin-forum.paradoxplaza.com/forum/developer-diary/stellaris-dev-diary-98-fleet-manager.1060624 . Later DD #295 says it "works, sort of" and was reorganised.
- **Planet UI (4.0, 2025).** DD #371 shows reworked planet view (visible district-upgrade button, renamed tabs); DD #387 reworked "Planet Production and Deficit" sections; DD #408 renamed Population to Economy. VERIFIED: https://forum.paradoxplaza.com/forum/developer-diary/stellaris-dev-diary-371-4-0-changes-part-5.1729244/ , https://forum.paradoxplaza.com/forum/threads/stellaris-dev-diary-387-4-0-21-is-out-whats-next.1790658/ , https://forum.paradoxplaza.com/forum/developer-diary/stellaris-dev-diary-408-2025-in-review.1887046/page-4 .

#### 1.7 Endless Space 2 (Amplitude, PC 4X)

- Praised (2017) for "sparse styling with thin lines" keeping dense content readable; screens for system view, tech tree, diplomacy, senate, planets. VERIFIED: https://www.hudsandguis.com/home/2017/7/6/endless-space-2 .
- Reviewers: one of the best UIs in its genre, but heavy shorthand/symbols caused early mistakes; "too efficient for its own good". VERIFIED (2017 reviews): https://www.pcgamer.com/endless-space-2-review/ , https://www.gamegrin.com/reviews/endless-space-2-review/ .
- Players: radial tech tree needs a lot of dragging; some windows spread options far apart. VERIFIED: https://steamcommunity.com/app/392110/discussions/0/1489987634003930848/ .
- Not verified: specific queue or empire-overview screen layouts.

#### 1.8 EVE Online (CCP) incl. Photon UI

- **Photon UI as a design system.** Nov 2022 post: inconsistent styles across features confused players; Photon addressed framework, tech debt and inconsistency; co-developed with players via opt-in. Added multiple Overview windows, compact mode, window margins, transparency, auto UI scaling. VERIFIED: https://www.eveonline.com/news/view/improving-photon-ui .
- **Compact mode** for Fleet, D-Scan, Probe Scanner, Overview, Selected Item, Locations, Watchlist, Drones; players noted compact mode drops some information. VERIFIED: https://devtrackers.gg/eveonline/p/f6c3ba6b-photon-ui-compact-mode-on-tq-feedback-thread , https://forums.eveonline.com/t/photon-ui-feature-preview-multiple-overviews-feedback-thread/385591 .
- **Opt-in before forced switch.** Feb 2023: Photon made the only UI after 94% voluntary adoption; one checkbox toggles compact mode for all windows. VERIFIED: https://www.eveonline.com/news/view/february-update-photon-ui-full-rollout , https://www.mmobomb.com/news/eve-online-rolls-out-new-photon-ui . Criticism: flat buttons blend into background, less readable at a glance: https://steamcommunity.com/app/8500/eventcomments/3763356923847198542/ .
- **Map.** 2014–15 star-map overhaul ran as an opt-in beta, then became default with the old map still reachable; beta feedback asked for a colour key. VERIFIED: https://evenews24.com/2015/04/27/dev-blog-x-marks-the-spot-the-new-star-map-is-out-of-beta/ . No 2024–25 map redesign found.

#### 1.9 Homeworld 3 (Blackbird, PC RTS; little UI documentation)

- After the 2024 demo, players found the HUD too large; devs added a HUD scale slider, less intrusive defaults, refactored elements. VERIFIED: https://www.homeworlduniverse.com/war-games-feedback/ .
- Sensors Manager = 2D strategic overview of the whole map with fog of war; keybind toggles for HUD, Build/Launch panels, Objectives, Events. VERIFIED: https://www.gamepressure.com/newsroom/homeworld-3-all-controls-and-keybinds/z66d6f . Player complaint: opaque sensor spheres, no full HUD hide: https://steamcommunity.com/app/1840080/discussions/0/4338725580138521141/ .

#### 1.10 Rise of Kingdoms (Lilith, mobile)

- **Seamless zoom** city - region - world with two fingers; holding "return to city" opens a radial menu of preset zoom levels (1.0.88). VERIFIED: https://riseofkingdomsguides.com/rise-of-kingdoms-1-0-88-giving-thanks-update/ , https://rok.lilith.com/ .
- **Reports:** all battle reports show a "battle evaluation"; reports can be shared to chat with commanders shown. VERIFIED: same 1.0.88 source.
- **Queues are monetised:** permanent second builder at VIP 6, otherwise 48 h items or gems; march queues 1 to 5 unlocked via City Hall. VERIFIED: https://www.appgamer.com/rise-of-kingdoms/strategy-guide/unlocking-the-2nd-builder-queue , https://riseofkingdomsguides.com/?p=12016 .
- **Not verified:** march preset UI, mail categories, battle report layout (no source found).

#### 1.11 EVE Echoes (NetEase/CCP, mobile)

- Planetary interaction deliberately simplified for mobile; a "Planetary Production" page lists planets of the system with resource richness. VERIFIED: https://gameworldobserver.com/2020/05/29/eve-echoes , https://sparkomarcogaming.wordpress.com/2020/08/13/trying-eve-echoes/ (2020).
- Reviews: "largely uncluttered", touch fits slow battles; double-tap movement; radial menus and autopilot. VERIFIED: https://pocketgamer.com/articles/081404/eve-echoes-serves-up-an-authentic-eve-experience-for-ios-and-android , https://apps.apple.com/us/app/eve-echoes/id1446384690 .
- Not verified: fleet dispatch or notification design.

#### 1.12 Clash of Clans (Supercell, mobile)

- **UI revamp (Oct 2026).** Two mirrored main buttons: Battle bottom-left, Build bottom-right; Build menu opens over the visible village and closes by tapping elsewhere; upgrades previously spread over four buildings plus a shop tab are now one sorted, filterable list in 4 tabs (Buildings & Heroes, Army Upgrades, Hero Equipment, Hero Pets); resource bar shows only relevant currencies; Battle groups Battle Log, Revenge, Live Replay, Edit Army. Follow-up: Builder menu will remember filter/sort. Known issue: affordable upgrades sometimes listed below unaffordable ones. VERIFIED: https://supercell.com/en/games/clashofclans/blog/news/weve-revamped-the-clash-of-clans-user-interface/ , https://www.sportskeeda.com/mobile-games/clash-clans-update-october-13-2026-all-new-home-screen-changes , https://x.com/ClashofClans/status/2116123007357780023 , https://trophycoach.com/clash-of-clans/guides/clash-of-clans-new-ui-2026-where-did-my-buttons-go .
- **Removed waiting (Mar 2025, "Clash Anytime").** Troop training times removed ("feels outdated to wait 15+ minutes between each attack"); Army Recipes replace Quick Train, autosave, share to clan chat. VERIFIED: https://supercell.com/en/games/clashofclans/blog/release-notes/welcome-to-clash-anytime-update , https://www.pocketgamer.com/clash-of-clans/ditching-troop-training-times , https://sportskeeda.com/mobile-games/clash-clans-march-2025-update-new-army-screen-recipe-explained .
- **Defense log** shows attacks on you and how defences were bypassed (replay). VERIFIED: https://apps.apple.com/us/story/id1500620631 .

---

### 2. Cross-game pattern table

| Pattern                                                                   | Games                                                                                            | Evidence                                                                                                            | Fit for Nova Imperium (small async, friends, desktop + phone)                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Empire-wide overview (all planets/villages in one table, tabs per aspect) | OGame (Empire view), Travian (central overview), Grepolis (Administrator), Tribal Wars (premium) | ogame.fandom.com/wiki/Commander ; support.travian.com/.../7000062844 ; support.innogames.com/kb/Grepolis/en_DK/3539 | High. Everyone gets it free (INFERRED: in all four it is a paid layer, which is what makes the base UI feel like a page-per-planet wall). |
| "Time until full/empty" and red deficits instead of raw numbers           | Travian warehouse tab, Tribal Wars premium, Stellaris "Production and Deficit"                   | support.travian.com/.../7000062844 ; DD #387                                                                        | High. Cheap to compute, removes number walls.                                                                                             |
| One sorted/filterable catalogue instead of many building pages            | Clash of Clans 2026 Build menu, FoE stable order + fade-out of invalid items                     | supercell.com/.../weve-revamped... ; FoE release notes                                                              | High. Replace per-category pages with one list + filter chips; sort "affordable first" (CoC known issue shows why it matters).            |
| Presets for repeated dispatch                                             | Travian farm lists, CoC Army Recipes, Stellaris fleet templates                                  | support.travian.com/en/articles/69-farm-lists ; sportskeeda CoC Mar 2025 ; DD #98                                   | High for expeditions/transport/attacks between friends; small data model.                                                                 |
| Categorised, groupable event log with pin/priority                        | Stellaris Situation Log 2026, FoE Event History filter, Travian report filters                   | DD #417 ; FoE 4278 ; support.travian.com/en/articles/58-reports                                                     | High. Core of "what happened while away".                                                                                                 |
| Compact summary first, detail on demand (reports)                         | OGame 11.15 compact spy reports, RoK "battle evaluation", EVE compact mode                       | OGame changelog 11.15.0 ; RoK 1.0.88 ; Photon compact mode                                                          | High, but keep key facts (planet/moon, coords) in the summary and allow expanded default (OGame backlash).                                |
| Persistent side list of own assets (outliner) beside the map              | Stellaris                                                                                        | cgmagonline review                                                                                                  | Medium on desktop (sidebar of planets + fleets); on phone becomes a sheet.                                                                |
| Semantic zoom with preset levels                                          | RoK, Homeworld 3 Sensors Manager, EVE star map                                                   | RoK 1.0.88 ; gamepressure HW3                                                                                       | Medium. Galaxy - system - planet zoom is natural; keep table as accessible alternative.                                                   |
| Bottom bar with few primary actions on mobile                             | OGame mobile, CoC 2026 (Build/Battle)                                                            | OGame mobile changelog ; Supercell revamp                                                                           | High for phone.                                                                                                                           |
| Opt-in rollout of new UI, then default                                    | EVE Photon (94%), EVE star map                                                                   | eveonline.com Feb 2023 ; evenews24 2015                                                                             | High. Friends group can test with a toggle.                                                                                               |
| Undo/grace window for orders                                              | Travian 90 s training refund                                                                     | travian.com Oct 2024 QoL                                                                                            | High; recalling a fleet already exists in OGame-likes; extend to builds.                                                                  |
| UI scale / compact density setting                                        | EVE (auto scaling, compact), Homeworld 3 HUD slider                                              | eveonline.com improving-photon-ui ; homeworlduniverse.com                                                           | Medium. One density toggle covers desktop power users and phone.                                                                          |
| Simulator linked from report                                              | Travian                                                                                          | support.travian.com 144.5                                                                                           | Medium; useful if Nova has a combat simulator.                                                                                            |

---

### 3. Anti-patterns to avoid

| Anti-pattern                                                             | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                        | Note for Nova Imperium                                                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pay-to-skip / artificial waits                                           | vzbv 2025 paper on manipulative design (waits up to an hour, real-money cost not shown): https://www.vzbv.de/sites/default/files/2025-04/25-03-11_Paper_vzbv_Manipulative_design_unfair_practices_online_games.pdf ; EU BIK: https://better-internet-for-kids.europa.eu/en/dark-patterns ; AAAI 2024 "Pay to (Not) Play": https://ojs.aaai.org/index.php/AAAI/article/view/28846 ; Grepolis gold halving in Senate (wiki above) | No speed-up buttons. Timers stay as game rules only.                                                                                                               |
| UI comfort sold separately (queues, empire view, presets behind premium) | OGame Commander, Travian Plus/Gold Club, Grepolis Administrator, TW Account Manager, RoK 2nd builder at VIP 6 (sources in section 1)                                                                                                                                                                                                                                                                                            | INFERRED: these are exactly the screens that fix the number-wall problem; Nova should give them to everyone.                                                       |
| Playing by appointment / "wait to play"                                  | Zagal, Björk, Lewis 2013 "Dark Patterns in the Design of Games": https://research.chalmers.se/en/publication/177148 ; summary of darkpattern.games categories: https://pressanybutton.substack.com/p/avoiding-dark-patterns-in-mobile ; critique of the concept: https://eprints.whiterose.ac.uk/156460/1/DiGRA_2020_paper_189.pdf                                                                                              | Async friends' game: queues long enough to cover a night; presets reduce must-be-online moments. Supercell itself called 15-min waits "outdated" (CoC blog above). |
| Notification spam                                                        | Google Play: more daily notifications correlate with higher opt-out in games: https://medium.com/googleplaydev/optimizing-notifications-in-games-5efd6ba89701 ; FoE added per-type push toggles (release notes above); Stellaris lets alert types be disabled                                                                                                                                                                   | Few, typed, user-configurable notifications; digest by default.                                                                                                    |
| Forced redesign that removes information                                 | OGame 11.15.0 compact spy reports with no opt-out (forum thread above); EVE Photon critics on readability (Steam thread above)                                                                                                                                                                                                                                                                                                  | Keep a "detailed" toggle; never drop key fields from summaries.                                                                                                    |
| Unstable list order                                                      | FoE fixed building menu order changing on each login; CoC known issue with affordable items sorted below unaffordable                                                                                                                                                                                                                                                                                                           | Deterministic sort, remembered filters.                                                                                                                            |
| Overly symbolic, shorthand UI                                            | ES2 reviews (section 1.7)                                                                                                                                                                                                                                                                                                                                                                                                       | Icons always with German labels or tooltips.                                                                                                                       |

---

### 4. Recommendations for Nova Imperium

Each recommendation is INFERRED (a proposal); the evidence column in section 2 and the sources in section 1 back it.

1. **Navigation: few hubs instead of a long menu.** Group into about 5 hubs, e.g. _Imperium_ (overview), _Planet_ (build, research, shipyard, defence as tabs), _Flotten_, _Galaxie_, _Nachrichten_, plus Allianz/Rangliste under a secondary menu. Evidence: CoC 2026 merged four buildings + shop into one Build entry; Grepolis/Travian reach queues from one place.
2. **Planet switch stays global and shows state.** Keep the planet selector in the header, but each entry shows resources-near-full and active queue icons (Grepolis app city list with resources and current activity, Travian overview). On phone it opens as a sheet.
3. **Free "Imperium" overview as the home page.** One table: planets as rows; columns for resources (with "voll in 3 h" instead of raw storage), production per hour, current build/research/shipyard item with progress bar, defence status, incoming fleets. Tabs as in Travian (Übersicht, Ressourcen, Lager, Flotten). Evidence: OGame Empire view, Travian central overview, Grepolis Administrator; all premium elsewhere.
4. **Catalogue lists: one list, filter chips, status-first sorting.** Replace equal-weight rows with a compact list grouped by state: _baubar jetzt_, _bald baubar (Ressourcen fehlen, Zeit bis leistbar)_, _gesperrt (Voraussetzung)_. Collapse locked items, fade invalid ones (FoE Upgrade Kit), keep order stable and remember filters (FoE, CoC follow-up). Detail (description, full costs, prerequisites) in a side panel/bottom sheet, not in every row.
5. **Cost display as bars, not number walls.** Each cost shows have/need as a mini bar and a "fehlt: X" delta; build time and finish clock time. Evidence: Travian warehouse countdowns, Stellaris deficit sections (INFERRED transfer).
6. **Queues visible everywhere.** A persistent queue strip (desktop: sidebar; phone: collapsible bar above the bottom nav) for the current planet, plus all planets' queues in the Imperium overview. Evidence: Travian "Training" tab, OGame Commander queue.
7. **Fleet dispatch as one screen with live preview.** Ship selection, target (prefilled from galaxy/report/preset), mission, speed and cargo on one page; a summary panel updates arrival time, return time, fuel and cargo live. The open-source OGame re-implementation and players' 2010 request show the multi-page flow is the pain point. Validation errors inline.
8. **Dispatch presets ("Vorlagen").** Save ship mix + mission (+ optional target list), "alle starten" for a list, like Travian farm lists, CoC Army Recipes, Stellaris fleet templates. Launch from galaxy row or report with one tap.
9. **Grace window for orders.** Allow cancelling a just-started build/shipyard order with full refund for a short window (Travian 90 s), in addition to fleet recall.
10. **Galaxy: map plus table.** Keep the table as the accessible and phone-friendly view, but add a system/galaxy map with semantic zoom (galaxy, system, planet) and an inspector panel for the selected slot with actions (spionieren, angreifen, transportieren, Vorlage starten). Evidence: RoK zoom presets, Homeworld 3 Sensors Manager, EVE map opt-in rollout. Mark own/friend/enemy and activity by colour **with a legend** (EVE beta feedback).
11. **Reports: summary card first, detail on demand, filters.** Card: outcome, losses on both sides as numbers and bars, loot, debris, moon chance, coordinates and planet-or-moon (the field OGame players missed). Expand for round-by-round detail. Filters by type and player, "delete filtered" (Travian 144.5), link to simulator if one exists. Make "expanded by default" a setting.
12. **"Seit deinem letzten Besuch" digest.** Group events since last login into categories (Kämpfe, Spionage, Bau fertig, Flotten zurück, Allianz) with counts, collapse high-volume items, allow pinning (Stellaris Situation Log 2026, FoE Event History filter).
13. **Notifications: few, typed, opt-in.** Push/e-mail only for incoming attacks and optionally "Queue leer"; everything else in the digest. Per-type toggles (FoE, Stellaris). Evidence on opt-out rising with frequency (Google Play).
14. **Highscore and statistics as charts.** Rank table with position deltas (up/down arrows since yesterday) and a small points-over-time line per player; production shown as stacked bars per planet. Note: no game source above documents score charts; this is INFERRED from the Travian/Stellaris delta patterns and the owner's goal.
15. **Mobile: bottom bar + sheets + density toggle; roll out opt-in.** 4 to 5 bottom tabs matching the hubs (OGame mobile bottom menu with active-tab indicator; CoC primary actions at the bottom corners for thumbs), detail panels as bottom sheets, one "kompakt" toggle (EVE compact mode checkbox). Ship the new layout behind a per-user toggle first and switch the default once the friends have adopted it (EVE Photon at 94%).

#### Open gaps worth a follow-up (if pages become reachable)

- Official current OGame desktop menu and galaxy table; whether any one-page dispatch exists.
- Rise of Kingdoms march presets and mail/report layout; EVE Echoes fleet and notification UI; Endless Space 2 queue/empire screens.
- Full text of Stellaris DD #154 and DD #417, EVE Photon dev blog, Travian 2023 "5 years" post (only excerpts were available).

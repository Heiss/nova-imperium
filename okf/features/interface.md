---
type: feature
title: Interface v2 and planet types
description: Design of the game interface with the Nova Imperium icon set, the phone navigation, animated planets and the planet type rule.
tags: [interface, design, icons, phone, planets, accessibility]
status: decided
generated: { by: claude-code/web, at: 2026-11-10T19:00:00Z }
---

# Decisions (owner, 2026-11-10, issues #61 and #52)

* **[E]** The interface follows the delivered icon set: dark bronze ground,
  gold frames, Cinzel for headings and EB Garamond for text, both self-hosted
  (SIL OFL 1.1, `src/client/static/fonts/`). The old blue design is replaced
  completely (D6).
* **[E]** Icons are static files under `src/client/static/icons/` (D1); the
  mapping from catalog keys is `src/client/logic/icons.ts`. The drawn
  pictures of version 1 (`art.ts`) are removed (D5).
* **[E]** Below 32 px the resources use simplified icons
  (`icons/resources/small/`, D2).
* **[E]** Lists of buildings, research, shipyard and defense stay rows (D4).
* **[E]** Phone (≤ 760 px): bottom tab bar with Übersicht, Gebäude, Flotte,
  Nachrichten and „Mehr“; „Mehr“ opens a bottom sheet (`<dialog>`) with the
  other entries. The desktop keeps the side menu.
* **[E]** No view is wider than a phone of 360 px (owner, 2026-11-14, #189
  D7, fixed at once as a bug); `e2e/phone-overflow.spec.ts` visits every
  view and every tab of the admin at 360 px and fails on a page that
  scrolls sideways.
* **[V]** How (#189 D7, until the phone view of #189): on a phone the
  resources table shows every row as a block of its own (the name, the four
  values in two columns, each with its column head, then the share).
* **[E]** Highscore on a phone (owner, 2026-11-14, #189 D7): the column
  „Heimatplanet“ is hidden and its coordinates link [g:s:p] (to the system
  on the Sternenkarte) stands small below the player name. A long name
  breaks only when it does not fit („Umbruch nur im Notfall“, owner,
  2026-11-14, after CodeRabbit on #207: 20 × „W“ ran over the points at
  360 px); normal names stay on one line.
  The desktop keeps the column. The link is rendered once and only moved by
  CSS, so neither layout has a duplicate for the keyboard or a screen reader.
* **[E]** Planets are layered CSS pictures (D7): a tileable surface that
  turns, clouds that drift, day and night shading and a breathing atmosphere
  halo in the colour of the type. Three fixed variants per type (D8),
  textures from `scripts/planet-textures.ts`. Galaxie shows them small and
  still.
* **[E]** Animations stop with the system setting „Bewegung reduzieren“ and
  with the switch „Animationen“ in „Hilfe & Optionen“, stored per device
  (D9, WCAG 2.2.2).
* **[E]** Speeds (owner feedback on the draft): surface 1.5–4.5 min, clouds
  30–75 s per tile, atmosphere 7.5 s.

# Planet type (issue #52)

* **[E]** The type changes the look only (D1.1); no effect on production,
  fields or temperature. The temperature model stays (D3.1).
* **[E]** The type follows slot and system parity (D2.1):

| Slot | odd system | even system |
|---|---|---|
| 1–3 | Trockener Planet | Wüstenplanet |
| 4–5 | Normaler Planet | Trockener Planet |
| 6–7 | Dschungelplanet | Normaler Planet |
| 8–9 | Wasserplanet | Dschungelplanet |
| 10–11 | Eisplanet | Wasserplanet |
| 12–13 | Gasriese | Eisplanet |
| 14–15 | Normaler Planet | Gasriese |
| 16–20 | Gasriese | Gasriese |

* **[E]** Slots 16 to 20 (universes with more than 15 positions) are gas
  giants (owner decision).
* **[E]** Existing planets get their type by the rule (D4.1). The type is a
  pure function of the coordinates (`src/core/planet-type.ts`), so no
  stored column and no migration are needed.
* **[V]** Variant = (galaxy + system + slot) mod 3, so neighbours differ.

# Header line (issue #241)

* **[E]** The owner (2026-11-16): the header showed the active planet twice,
  as text and right next to it in the list „Aktiver Planet“; once is
  enough.
* **[V]** With more than one own place, the header names the active planet
  (name and position) only in the list „Aktiver Planet“; the text goes
  away. With one planet there is no list, so its name and position stay as
  text, else the header would not name it at all.
* **[V]** Order (D1, taken as recommended): the list first, then
  „Kommandant …“ and „Logout“.
* **[V]** Phone (D2, taken as recommended): the same rule as on the desktop.
* **[V]** The list keeps its label „Aktiver Planet“ (accessibility).
* Built in `src/client/views/Header.svelte`; unit tests in
  `src/client/views/frame.test.ts`, the E2E test with axe on the header in
  `e2e/header.spec.ts` (desktop and phone). The E2E tests read the active
  place of several from the entry of the list that the rendered header
  marks with the attribute `selected` (`expectShownPlace()`, `shownPlace()`
  of `e2e/helpers.ts`): it comes from the applied state, while a choice in
  the list changes only which entry is checked, before the state of the
  new planet has arrived (CodeRabbit on #251).

# Cargo in the fleet movements (issue #259)

* **[E]** The owner (2026-11-16): the list of the fleet movements (the
  Übersicht and „Flotten unterwegs“ of the fleet view) shows, for each own
  fleet, its ships and the resources it carries.
* **[V]** On its way out the row shows what the fleet carries, on its way
  home what it brings back (loot, harvested debris, the rest of a
  transport that was not unloaded): after the mission, or after „zurück“,
  „ · Ladung: “ and the cargo as everywhere else („Adamant 10.000 ·
  Psikristall 5.000 · Promethium 0“, `resLine` as it is, so a resource
  with 0 stays in the line; Geklärt on #259).
* **[V]** A fleet whose cargo is all 0 shows no cargo part. The gift of the
  Endzeit (#161) shows its cargo the same way.
* **[E]** Foreign fleets are unchanged: no cargo. No server change; the
  server already sends the cargo of own fleets only.
* Built in `fleetParts()` of `src/client/logic/overview.ts`; unit tests in
  `src/client/logic/overview.test.ts`, E2E tests in `e2e/flows.spec.ts`
  (the fleet view on the desktop, the Übersicht on a phone of 390 px
  without sideways scrolling).

# Header and menu while scrolling (issue #193)

* **[E]** The owner (2026-11-14): on the desktop the header with the
  resources and the side menu on the left stay visible while the page
  scrolls.
* **[E]** D2: while scrolled the header gets slimmer: the logo line hides,
  the resources stay (owner, 2026-11-14).
* **[E]** D1, changed (owner, 2026-11-14): the phone stays as it is (its
  header is already sticky); the observation in Firefox on Android is taken
  as a short glitch, with no reproduction and no Firefox test project.
* **[E]** Keyboard focus is never hidden under the fixed parts (WCAG
  2.4.11).
* **[V]** How: the header is sticky with its logo line above the top of the
  screen (a negative `top`), so it slims as the page scrolls, without a
  jump, and is full again at the top. The side menu sticks right below the
  rest of the header and scrolls on its own when it is taller than the
  screen; since it no longer reaches down the page, `#app` paints its
  column and line. The lengths depend on how the header wraps, so
  `src/client/logic/sticky-header.ts` measures them (when the client
  starts and whenever the header or the resource bar changes size) and
  sets `--head-h` and `--head-hide`. When the logo has a line of its own
  above the resources, everything down to the bottom of the logo goes
  above the screen (measured at 1,100 px: 128 px full, 72 px scrolled).
* **[E]** One-line header (owner, 2026-11-17): on a header that fits one line
  (full width, short name; the logo stands beside the resources, measured at
  1,280 px with a short player name: 72 px) the logo becomes **smaller**
  while scrolled; a header that wraps slims as above (the logo line goes
  above the screen). Whether the header wraps depends on the width and the
  length of the header line (below about 1,210 px, or a longer name at
  1,280 px). **[V]** The sizes: the logo 22 px to 16 px and its subtitle
  13 px to 11 px (the owner named no size; the header keeps its height, as
  the resource bar sets it). `src/client/logic/sticky-header.ts` sets the
  classes `head-line` (one line) and `scrolled` (the page is not at its top,
  from the scroll event) on `<html>`; the CSS needs both.
* **[V]** `scroll-padding-top` keeps the focus below the header (on the
  phone below the full header) and, on the phone, `scroll-padding-bottom`
  above the fixed tab bar.
* Built in `src/client/static/style.css` („Sticky header“), wired in
  `src/client/views/frame.ts`; unit tests in
  `src/client/logic/sticky-header.test.ts`. An E2E test with axe is still to
  write (desktop at 1,100 px and 1,280 px, and phone: the long view Gebäude
  scrolled to its end and back, resources and menu in view, the logo
  smaller on the one-line header, Tab down and Shift+Tab up to controls out
  of sight); an earlier draft is on the branch `claude/sticky-header`.

# Lighter phone view (issue #189)

The owner (2026-11-14, „Geklärt“ and „Geklärt, Nachtrag“ on #189) decided
D1 to D7; D7 (no view wider than 360 px) is built (#207, above). The
rest is built in parts; this section says what is, and what is still to do.
Up to 760 px only; the desktop stays as it is (D6).

## Decided

* **[E]** D1: the tab bar is Übersicht · Bauen · Flotte · Karte · Mehr; the
  messages move to the bell in the header (owner, 2026-11-14).
* **[E]** D2 and D3: one tab „Bauen“ with a switch Gebäude / Forschung /
  Schiffsschmiede / Abwehr; each entry is a compact row (picture, name and level,
  costs, time, „▲ 5“), and a tap unfolds the details (owner, 2026-11-14).
* **[E]** D4: the default filter is „Baubar“; entries whose requirements
  are missing show with them under „Alle“ (owner, 2026-11-14).
* **[E]** D5: the Übersicht is a dashboard with the cards „Läuft“,
  „Achtung“ and „Bereit“, then the planet facts; the long planet table moves
  down (owner, 2026-11-14).
* **[E]** D6: phones only, up to 760 px; D7: built (#207).
* **[E]** Unchanged from the issue, still [V] (owner, 2026-11-14): the
  compact header (planet chip, bell, one line of resources, logout in
  „Mehr“), the Sternenkarte rows with the „⋯“ sheet, the folded long pages,
  the German texts and touch targets of at least 44 px.

## Built (part 1, #189)

* **[V]** „Bauen“: the tab leads to the list of buildings; at the top of
  each of the four lists a switch of four links (Gebäude, Forschung, Schiffsschmiede,
  Abwehr) and a filter of three buttons (Baubar, Alle, Läuft). The tab is
  marked in all four lists. The lists of research, shipyard and defense stay
  reachable under „Mehr“, too, since the E2E helper `nav()` uses them there.
  `CatalogList.svelte`, `logic/phone-build.ts`, `logic/navigation.ts`.
* **[V]** Phases (`rowPhase()`): „Läuft“ is an upgrade or a research that
  runs, or a unit of the shipyard or defense with an order in the queue;
  „locked“ is an entry with the note „Das Wissen ist noch verschlossen“;
  everything else is „Baubar“, also while it waits for resources, energy,
  fields or the queue (its note stays in the row). The owner named no rule.
* **[V]** The filter is CSS on `data-filter` and `data-phase`, so the desktop
  shows every row. The filter and the unfolded rows live in
  `logic/phone-build.svelte.ts`; the filter is kept across a reload since
  part 4 (below), the unfolded rows are not.
* **[V]** The compact row: picture 48 px, name with level, costs, the time
  line („Bauzeit“, „Forschungszeit“), and on the right the button; the fold
  button „▾“ (44 px) is at the end of the name. Unfolded it shows the
  description, the energy and other lines, the requirements, the „?“ and „▤“
  and „Zurückbauen“. An entry whose requirements are missing shows them
  without a tap. A row with a number field (ships, defense) or a note takes
  the line below the name.
* **[V]** „▲ 5“: a button that names a level („Ausbauen auf Stufe 5“,
  „Forschen (Stufe 4)“) shows „▲ 5“ on a phone; „Bauen“ stays. The button
  has no `aria-label`: its full name stays its text, which the CSS takes out
  of sight on a phone (clipped, not `display: none`) and shows in full on the
  desktop; the short label is `aria-hidden`. So the name a reader or voice
  control hears is the full one on both, and axe (`label-content-name-mismatch`,
  WCAG 2.5.3) has no label to compare with the visible text. An earlier draft
  had an `aria-label` and showed both texts on the desktop; axe rejected it.
* **[V]** Layout rules found by the E2E tests (2026-11-19): the tab bar and
  the switch of the four lists share their width by content and never reach
  past 360 px; the four resources of the header are a flex line that wraps
  when four large stocks do not fit (a column of a grid cannot be narrower
  than its number); the tables `kv` (the fleet form) have fixed columns and
  their fields fit the cell, since a „Schnellwahl“ with long options made the
  page wider than the screen, the phone zoomed out, and the fixed tab bar was
  no longer where Playwright clicked.
* **[V]** Empty filter: „Nichts ist baubar. „Alle“ zeigt auch, was noch
  fehlt.“ and „Es läuft gerade nichts.“.
* **[V]** The compact header: the logo, the commander and „Logout“ are hidden
  on a phone; the planet is the list „Aktiver Planet“ as a 44 px chip beside
  the bell, below it one line of four resources (icon 20 px beside the
  number). Measured at 360 px: about 90 px instead of 140 px. The commander
  and „Logout“ stand at the top of the sheet „Mehr“ (`MoreUser.svelte`); the
  bell (`Bell.svelte`) links to the messages and shows the unread number
  (99+ above 99); „Mehr“ still marks unread messages.
* **[V]** The Sternenkarte on a phone is one block per position (the name no
  longer breaks inside a word); the actions are behind the „⋯“ sheet (part 3,
  below).
* **[V]** Achievements on a phone (`logic/achievement-fold.ts`): „Offen“ shows
  the next goal of each series (the lowest target not claimed), „Erledigt“
  only its button; two buttons unfold them („Alle N zeigen“, „Nur die
  nächsten Ziele zeigen“, „N erledigte zeigen“, „Erledigte ausblenden“).
  „Einlösbar“ is always open.
* **[V]** The Übersicht on a phone: the fleet movements and the activities
  stand above the planet table (CSS `order` only).

## Built (part 2, #189): the cards of the Übersicht

* **[E]** D5: the cards „Läuft“, „Achtung“ and „Bereit“, then the planet
  facts (owner, 2026-11-14). What counts as „Achtung“ and „Bereit“ is the
  proposal of the issue; the rest is **[V]**.
* **[V]** Where: `logic/overview-cards.ts` (pure, tests next to it),
  `views/OverviewCards.svelte`, mounted by `Overview.svelte` right after the
  title. The section is `phone-only` (hidden above 760 px, like the filter of
  the lists); the fleet movements, the planet and the activities below it are
  unchanged, so the desktop is as before.
* **[V]** „Läuft“ (always shown): the activities of the shown place, each
  with its countdown (the clock counts it down) and a bar: building and
  research over their whole length, the shipyard over the unit that is being
  built. Empty: „Es läuft gerade nichts.“.
* **[V]** „Achtung“ (shown only with a line): a hostile fleet on its way to
  the shown place (Sturmangriff, Mondbruch, missiles; no spy, transport,
  deployment or holding fleet) as „<Mission> von <Name> [g:s:p]“ with its
  countdown, the soonest first, at most 3, then „und N weitere Flotten“ with
  the link „Zur Flotte“; and missing energy as „Zu wenig Energie: es fehlen N“
  with the link „Zu den Gebäuden“ (the wording of the lists).
* **[V]** „Bereit“ (shown only with a line): „Erfolg abholbar“, „Tagesbelohnung
  abholbar“ or both (the wording of the mark on „Achievements“, link
  „Abholen“) and „N ungelesene Nachrichten“ (singular „1 ungelesene
  Nachricht“, link „Lesen“). Links are 44 px high.
* **[E]** The line „idle build queue on another planet“ of „Bereit“ is built
  with a small server part of the state (owner, 2026-11-20, option (a) on
  #189, „Geklärt“).
* **[V]** The state part: `src/server/game/idle-queues.ts`, key `idle`, order
  220 (200 `quick` and 210 unions are taken). The value is an array of ids
  (strings) of the player's own planets and moons but the shown place whose
  build queue is empty at the time of the request (no queue, or one that has
  ended); nothing else of those places is sent. It is a filter over the
  planets of the player, built for every state request, no settling. The
  vacation lock screen does not carry it. The client (`GameState.idle`,
  optional) words each id from `galaxy`.
* **[V]** The line: „Bauschleife leer: <Name> [g:s:p]“ (a moon „<Name> (Mond)“)
  with a button „Wechseln“ (`data-act="selectPlanet"`), after the reward and
  the messages; at most 3 lines, then „und N weitere“ without a button
  (`MOST_IDLE`). A place the galaxy does not list is left out.

## Built (part 3, #189): the „⋯“ sheet of the Sternenkarte

* **[E]** The Sternenkarte rows with a „⋯“ that opens a bottom sheet with the
  actions and the flight time; an empty position is a thin row (proposal of
  the issue, kept by the owner as [V], 2026-11-14).
* **[V]** Up to 760 px a position that has an action has a „⋯“ button (44 px,
  `aria-label` „Aktionen für <Name> [g:s:p]“, `aria-haspopup="dialog"`) at the
  right of its row; the actions of the row (`.gal-acts`) are hidden there and
  shown as before above 760 px. A row with only the dim „Aktiver Planet“ has
  none. A free position with a Landnahme, a Vermessen, an expedition or a
  Bergung has one, a free position without an action stays a thin row.
* **[V]** The sheet is a modal `<dialog>` like „Mehr“ (`dialog.sheet` shares
  its CSS): the title „<Name> [g:s:p]“ (a free position „Position [g:s:p]“,
  the expedition position „Expeditionsposition [g:s:p]“), the line „Flugzeit
  mit allen Schiffen: <time>“ (all ships of the shown place that fly, at full
  speed; left out without such a ship), each action as a 48 px button with the
  same `data-act` and data attributes as in the row, and „Schließen“. A tap on
  an action, on the backdrop or Escape closes it; the focus returns to the
  „⋯“ when it is dismissed. The open sheet is `ui.gsheet` (the id of the
  place, `free-<position>` for a position), so a render keeps it open; the
  handler `gsheet` is in `features/galaxy.ts`, the model in `logic/galaxy.ts`
  (`GalaxySheet`), the markup in `Galaxy.svelte`.
* **[V]** After „Schließen“ of a Phalanx scan the focus goes to the „⋯“ when
  the scan button is not in sight (on a phone).
* E2E: the specs that click an action of a row on a phone open the sheet first
  (`galaxyAction()` of `e2e/helpers.ts`).

## Built (part 4, #189): „Optionen“ in sections and a filter that is kept

* **[E]** „Hilfe & Optionen“ in sections (proposal of the issue, kept by the
  owner as [V], 2026-11-14). The page is called „Optionen“ since the rules
  moved to the Lexicanum (#288), so no section is called „Hilfe“.
* **[V]** Up to 760 px a switch of five buttons („Spiel“, „Runde“, „Konto“,
  „Gerät“, „Weiteres“; `div.seg.phone-only`, `aria-pressed`) shows one section
  of the page; „Spiel“ is the first. Spiel: the box „Optionen“ and
  „Hauptplanet“; Runde: „Urlaubsmodus“, „Meine Aktivität & Spielzeit“ and
  „Rundenarchiv“; Konto: „Passwort ändern“, „Passkeys“ and „Account löschen“;
  Gerät: „Darstellung“, „App installieren“, „Benachrichtigungen“ and
  „Browser-Benachrichtigungen“; Weiteres: „Problem melden“ and the line with
  the link „Dieses Universum“. Above 760 px every box shows as before.
* **[V]** How: `Box.svelte` takes an optional `section` and writes
  `data-sec`; the boxes stand in one `div.opt[data-section]`; the CSS hides
  the boxes of the other sections on a phone (`logic/phone-options.ts`, the
  section lives in `logic/phone-options.svelte.ts` for the session; a reload
  starts with „Spiel“). Every id, `data-act` and form stays in the page
  whichever section is shown, so a feature that fills `#own-activity` or
  `#passkey-list`, `#pwa-install` and the forms work as before
  (`views/options.test.ts` lists them for every section). The archive box
  stays one box of the section „Runde“, so the component of bundle 7 replaces
  it there.
* **[V]** The filter „Baubar“ / „Alle“ / „Läuft“ of the four lists is kept per
  device: `localStorage` key `nova.build.filter` (like `nova.animations`),
  read once when the module loads and written on every choice, both in
  try/catch; with no stored value, a value that is no filter, or a blocked
  storage it is „Baubar“ (D4). The unfolded rows are not kept. The `Läuft`
  filter is kept too, so a reload shows it again (the owner named no rule).
  `logic/phone-build.svelte.ts`, `phone-build.ts` (`filterFrom`).

## Still to do

* A check at 44 px of the smallest buttons that existed before (`small`).
* E2E: the phone tests that click „Logout“, open a locked entry, the „?“ or
  „▤“ of a row, or read a row of the lists without the filter must unfold or
  choose „Alle“ first (see the log entry of 2026-11-19); the ones that use the
  boxes of „Optionen“ choose the section first.

# Design draft

`docs/design/interface-v2/` holds the mockup, the full icon set and the
screenshots that led to these decisions.

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

# Design draft

`docs/design/interface-v2/` holds the mockup, the full icon set and the
screenshots that led to these decisions.

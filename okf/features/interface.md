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
  pure function of the coordinates (`src/shared/planet-type.ts`), so no
  stored column and no migration are needed.
* **[V]** Variant = (galaxy + system + slot − 3) mod 3, so neighbours differ.

# Design draft

`docs/design/interface-v2/` holds the mockup, the full icon set and the
screenshots that led to these decisions.

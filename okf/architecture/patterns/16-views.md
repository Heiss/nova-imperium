---
type: Architecture
title: '16. Svelte views register themselves'
description: 'A view exports clientViews (key, mount or html, anew, menu entry, glyph, tab) from its own module; mount.ts and index.ts name no view (#317).'
---

# 16. Svelte views register themselves (#317)

* **[E]** Decided by the owner (2026-11-20, #317): `MOUNT` and `ANEW` of
  `src/client/views/mount.ts` and `VIEWS` and the menu of
  `src/client/views/index.ts` stop being edited by every view.
* **[V]** A module in `src/client/views/` exports `clientViews`, a list of
  `ClientView` (`contract.ts`): `key`, `mount` (a Svelte view) or `html` (a
  view still drawn as a string), `anew` (mounted anew on every render),
  `menu` (`order`, `label`, `show`, `divider`), `glyph` and `tab`. The
  menu order of today is data: the entries stand at 10 to 180 (see `MenuItem`
  in `contract.ts`), the tabs of a phone at 10 to 40. The list is the
  git-ignored `views.gen.ts` (`CLIENT_VIEWS`); `assemble.ts` puts the modules
  together (`MOUNTED`, `ANEW`, `VIEWS`, the menu, the tabs and the glyphs are
  derived from it) and throws when a key, a menu number, a tab number or a
  glyph exists twice, naming both files; the guard is
  `src/client/views/registry.test.ts`. `mount.ts` and `index.ts` name no view
  and `main.ts` is not edited. Moved with #317: Übersicht, Gebäude, Rohstoffe,
  Marktplatz, Forschung, Schiffsschmiede, Verteidigung, Flotte, Sternenkarte,
  Nachrichten, Highscore, Gilden, Freunde, Achievements, Neuigkeiten,
  Lexicanum, Optionen and Admin; the four lists share `catalog-list.ts`, the
  glyph helper is `glyph.ts`. The menu, the labels, the glyphs and the tabs
  stay as they were (`index.test.ts` and `frame-reference.test.ts` check it).

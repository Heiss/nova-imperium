---
type: Architecture
title: '16. Svelte views register themselves'
description: 'A view exports clientViews (key, mount or html, anew or fresh, menu entry, glyph, tab, offered) from its own module; mount.ts, index.ts and the navigation name no view (#317, #352, #373).'
---

# 16. Svelte views register themselves (#317)

* **[E]** Decided by the owner (2026-11-20, #317): `MOUNT` and `ANEW` of
  `src/client/views/mount.ts` and `VIEWS` and the menu of
  `src/client/views/index.ts` stop being edited by every view.
* **[V]** A module in `src/client/views/` exports `clientViews`, a list of
  `ClientView` (`contract.ts`): `key`, `mount` (a Svelte view) or `html` (a
  view still drawn as a string), `anew` (mounted anew on every render) or
  `fresh` (mounted anew by a fresh render only, see below),
  `menu` (`order`, `label`, `divider`), `glyph`, `tab` and `offered`. The
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

* **[E]** Whether a view is offered is one rule on the view (#373; owner,
  2026-11-22, #351: a refactor of the v3 foundation without a change of
  behaviour, in a normal release). **[V]** The member `offered(round,
  admin)` of `ClientView` (default: always), put together by
  `assembleOffered` and asked through `offered()` of `views/offered.ts`: a
  view that is not offered has no menu entry (`menu()`), no tab
  (`phoneMenu()` drops a tab without a menu entry), no address
  (`hiddenView()` of `logic/navigation.ts`, so `gameView()` sends it to the
  overview) and is not mounted (`mountView()` falls back to the overview).
  Before the first state every view is open, as before. It replaces
  `MenuItem.show` and the names admin, achievements and guilds that
  `hiddenView()` kept by hand; „Admin“ (`admin`), „Gilden“ (`round.guilds`,
  #191) and „Achievements“ (`round.achievements || round.daily`) carry their
  rule. `registry.test.ts` checks for every view and round that the menu,
  the tabs and the address follow the rule, and that the navigation, the
  address, the mount and `index.ts` name none of these views.
* **[V]** A view mounted anew on every render loses the selection and the
  caret of a field the player is editing: the field is a new element, and
  `render.ts` gives the focus back by id only (#352; a selected number typed
  over became the old number with the new digit appended). A view with
  fields says `fresh` instead of `anew`: a fresh render (another view, a step
  of the page) mounts it anew and drops what was typed (`forgetForms`, #332);
  any other render (the poll, the clock, the news) keeps it and hands its
  `update` the view state. `mountsAnew()` of `mount.ts` is the rule;
  `registry.test.ts` checks it for every view. Built for the Sternenkarte
  (`views/galaxy.ts`, `GalaxyView.svelte`), for „Optionen“ (`views/options.ts`,
  `OptionsView.svelte`, #355: the page jumped on a phone and a tap hit the
  wrong switch) and, with the shared mount
  `keptMount()` of `views/kept.ts` (`KeptView.svelte`), for the fleet, the
  marketplace, „Freunde“, „Achievements“, „Gilden“ and „Admin“ (#361; owner,
  2026-11-22: all of them for 26.11.25).
* **[V]** The rule as a guard (#361): no view with a field a player types
  into is `anew`. `registry.test.ts` reads it from the sources: the Svelte
  components a view module imports, with every component they import, and a
  text area or an input that is not a box, a button or hidden is a typed
  field. A view still `anew` with such a field stands in its list
  `ANEW_WITH_FIELDS` with the reason, and the list holds only views that are
  still `anew`. The dialogs of the admin and the guilds stand in the modal,
  which a render does not touch. A countdown (`Due.svelte`) gets a new
  element for a new end, so a kept view never carries the clock's mark of a
  fired countdown (`data-fired`) into the next one.

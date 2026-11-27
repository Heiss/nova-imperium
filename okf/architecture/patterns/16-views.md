---
type: Architecture
title: '16. Svelte views register themselves'
description: 'A view exports clientViews (key, mount or html, anew or fresh, menu entry, glyph, tab, offered) from its own module; mount.ts, index.ts and the navigation name no view (#317, #352, #373); a feature switched off for the round is hidden, its Lexicanum page too (#404); the boxes of „Optionen“ register themselves the same way (#378).'
---

# 16. Svelte views register themselves (#317)

* **[E]** Decided by the owner (2026-11-20, #317): `MOUNT` and `ANEW` of
  `src/client/views/mount.ts` and `VIEWS` and the menu of
  `src/client/views/index.ts` stop being edited by every view.
* **[V]** A module in `src/client/views/` exports `clientViews`, a list of
  `ClientView` (`contract.ts`): `key`, `mount` (a Svelte view) or `html` (a
  view still drawn as a string), `anew` (mounted anew on every render) or
  `fresh` (mounted anew by a fresh render only, see below),
  `menu` (`order`, `label`, `divider`), `glyph`, `tab`, `offered` and
  `address`. The
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

* **[V]** The mark of a menu entry is on the view too (#426 part 3; owner,
  2026-11-26, 193b; the coordinator's choices of 2026-11-27): `hint: { mark,
  join? }`, where `mark({ state, unread })` gives the line or nothing; the
  functions stay in `src/client/logic/` (`menu-hints.ts`, `friends.ts`).
  `assembleHints` collects them as `MENU_HINTS` (`views/index.ts`, a view
  with two stops the start), `navigation.ts` hands them to `menuHints()`,
  and „Nachrichten“, „Achievements“, „Flotte“, „Gilden“ and „Freunde“ have
  one. A mark replaces a completed text of its view (`completions.ts`), or
  with `join` follows it after „ · “; only „Flotte“ joins, as before #426.
  Two modes, not one rule: `frame-reference.test.ts` generates a completed
  text for every view, and only the two modes keep it byte-identical. The
  mark of „Neuigkeiten“ is the one still set by hand in `navigation.ts`: it
  needs the news and the version seen, which are not in the state of the
  server.

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
* **[E]** A feature switched off for the round is hidden, not shown as
  closed (#404; owner, 2026-11-25): (112a) the marketplace gets its rule
  and every switch of the round is swept, so a player sees a switched-off
  feature nowhere: not in the menu, the tabs, a link, a mark or a card of
  the overview, and a guard test checks that every switch has its rule;
  (113a) the Lexicanum page of a switched-off feature is not listed and not
  reached by its address or a link, it falls back like an unknown article;
  (114a) the admin sees the same as every player, and the switch stays in
  the admin tab „Universum“. **[V]** „Marktplatz“ says `offered: marketOpen`
  (`round.marketOn === 1`); „Gilden“ and „Achievements“ take their rule as
  a function of the core too (`guildsOn` of `core/guild-chat.ts`,
  `rewardsOn` of `core/achievements.ts`). The switches are read from the
  registry of the round settings (a `switch`, or a number from 0 to 1, as a
  live switch is kept); `src/client/views/round-switches.test.ts` maps each
  to the views it turns off (`achievements` and `daily` to „Achievements“,
  `guilds` to „Gilden“, `marketOn` to „Marktplatz“) or names why it turns
  off none (`colonyResearch`: the research Kolonialverwaltung, a catalog
  entry the research list already leaves out, #237, catalog entries being
  #375; `expeditionSpeed`: a rule of the stay, no feature), and fails for a
  new switch until it is mapped, for a mapped view without a rule, and for
  a rule that does not hide the view while all its switches are off or
  hides it while one is on, for a player and the admin alike; with every
  switch on every view is offered, as before. The page of a feature in the
  Lexicanum carries the very function of its view (`PageDef.offered`; the
  guard checks the identity), because `logic/lexicanum.ts` is reached from
  the views and may not import `views/offered.ts` (a cycle);
  `opens(v)` of `logic/lexicanum.ts` leaves a hidden page out of the lists,
  „Begriffe A–Z“, the start page and its counts, the other articles of its
  kind, „Siehe auch“ and the search, keeps the words of a link to it as
  plain text, and `page()` answers its address with the start page, as for
  an unknown id. An open view of a feature switched off during the round
  falls back to the overview at the next state (`apply` of `sync.ts` asks
  `gameView`, `sync.test.ts`). The menu marks and the cards of the overview
  need no rule of their own: a mark stands on a menu entry only, and the
  only card linking such a view („Abholen“) shows a reward the server sends
  only while it is on.
  **[E]** (owner, 2026-11-25) (122a) the answer „Wie bekomme ich mehr
  Rohstoffe?“ of the Lexicanum has no row „Tauschen“ while the marketplace
  is off and no row „Belohnungen“ while both rewards are off
  (`faq-resources.ts`, `pages.blocks.test.ts`); (123a) „Dieses Universum“
  keeps every row, it states the settings of the round; (121a, 124a) the
  catalog entries Handelsposten and Kolonialverwaltung are hidden with
  #375, not here. **[V]** The closed branch of the page „Marktplatz“ stays
  until #375, though no player reaches it now.
* **[E]** A view declares its own address parameters (#379; owner,
  2026-11-22, #351: a refactor of the v3 foundation without a change of
  behaviour, for the deep links of the star map, #160). **[V]** The member
  `address` of `ClientView` lists the names (`&name=…`) in the order `go`
  takes their values; `assembleAddress` collects them, each name for one
  view (a name twice stops the start). `viewUrl` of `logic/address.ts` keeps
  the parameters of the open view with a value and drops those of every
  other view and the hash; `addressParams` reads them back.
  `client.ui.params` holds those of the open view instead of `ui.guild`
  (coordinator, 2026-11-24, option 1, [V]); `go(view, push, ...values)`,
  the start (`ui-init.ts`) and „back“ (`routing.ts`) fill it without naming
  a parameter. „Gilden“ declares `guild`, the Lexicanum `a` (it still reads
  its article itself, `articleParam`). `address-today.test.ts` lists the
  addresses of today, dropped cases too, and passed before and after the
  change; `registry.test.ts` checks that the address, the routing and the
  start name no parameter.
* **[E]** The boxes of „Optionen“ register themselves (#378; owner,
  2026-11-24: the option boxes only). **[V]** A module in
  `src/client/views/options/` exports `optionBoxes`, a list of `OptionBox`
  (`options/contract.ts`, declared with `optionBox()`): `key`, `order` (the
  boxes of today stand at 10 to 140, see `OptionBox` in `contract.ts`),
  `section` (the section of the phone switch, #189), `component` (the
  Svelte component that draws the box with its `data-sec`), `data` (its part
  of the page at the view state, moved out of `optionsPage()`) and `shown`
  (default: always; „Benachrichtigungen“ only with push kinds). `data` and
  `shown` with their part types are pure logic in
  `src/client/logic/options/<box>.ts` (no Svelte, nothing of the views; they
  read `OptionsState` of `logic/options/state.ts`), so they stay under
  mutation testing as `logic/options.ts` was; the module in `views/options/`
  only declares the box. The list is
  the git-ignored `options/boxes.gen.ts` (`OPTION_BOXES`);
  `assembleBoxes()` of `options/assemble.ts` puts the modules together in
  their order and throws when a key or an order number exists twice, naming
  both files; `options/boxes.ts` derives the page (`OptionsPage`,
  `optionsPage()`, still exported by `logic/options.ts`) from the parts of
  all boxes. `Options.svelte` keeps the switch and draws the boxes in their
  order; it names no box, nor does `logic/options.ts`. The guard is
  `src/client/views/options/boxes.test.ts` (key, order, section, members;
  no key, order or field of the page twice; the clash messages; the
  generated list, in `src/test/gen-option-boxes.test.ts`). The markup stays the same up to the white space between
  the boxes and within a line of text (`options.test.ts`,
  `options-reference.test.ts`). The census of the keyed lists
  (`keyed-lists.test.ts`, #369) moved the loops of the choices, the main
  planet and the push kinds to their box components with the same verdicts
  and judges the new loop of the boxes by the guard (coordinator,
  2026-11-24, [V]).
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

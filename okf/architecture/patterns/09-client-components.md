---
type: Architecture
title: '9. Client: generic Svelte components'
description: 'The client as generic Svelte components with a state module, the contract per component and the view-by-view conversion of #118.'
---

# 9. Client: generic Svelte components

* **[E]** One state module with Svelte 5 runes (`.svelte.ts`) replaces the
  module variables of `src/client/main.ts`; one component per view.
* **[E]** `main.ts` must not grow: a CI ratchet keeps its line count at or
  below its count on the base branch, and a pull request that shrinks
  `main.ts` lowers the limit for the next ones by being merged; no file
  holds the number (#242, #317 part 4, see
  [Test strategy](/ops/testing.md)).
* **[E]** Generic components render from the catalog: `CatalogList`
  (buildings, research, shipyard, defense) and `ProducerTable` (resources).
  A new entry needs no new HTML.
* **[E]** The catalog views are converted first (buildings, research,
  shipyard, defense), where #45, #51 and #53 add the most; then the other
  views (owner, 2026-11-13, #118).
* **[E]** Built with #114 (ProducerTable): `src/client/views/ProducerTable.svelte`
  renders the resources page, one row per entry of `producerRows()`, and
  `mountProducerTable()` (`src/client/views/producer-table.ts`) mounts it
  like `mountBuildings()`; `renderView` in `src/client/main.ts` mounts the
  view `resources` as the second Svelte view and updates it on every
  render. The share selects keep `data-chg="pct"`, `data-k` and
  `data-nokeep`.
* **[E]** Built with #118, first pull request (the four lists, owner D1 of
  2026-11-13): the state module is `src/client/logic/state.svelte.ts`, one
  object `client` with runes. `client.game` (the state of the server) and
  `client.shown` (what the mounted views show) are `$state.raw`, replaced
  as a whole; `client.view` (the view state of the last render, which the
  completion notices compare with), `client.ui`, `client.offset` with
  `client.now()`, `client.lastKey`, `client.completionNotices` and
  `client.completedMenu` are plain fields; `client.forget()` clears what
  belonged to another planet, player or round. `main.ts` keeps no copy of
  them (`S`, `ctx`, `offset`, `lastKey`, `ui` and the two notice lists are
  gone). Every game action goes through one `act()`, built by `createAct()`
  of `src/client/logic/act.ts`, which applies the answer only while the
  player looks at the same planet (`placeOf`, `samePlace`, also used by
  `refresh()`). The views keep `data-act` and the one click handler of
  `main.ts`.
* **[E]** `CatalogList` (`src/client/views/CatalogList.svelte`, mounted by
  `mountCatalogList()`) renders Gebäude, Forschung, Schiffsschmiede and
  Verteidigung from `catalogPage(v, kind)` of
  `src/client/logic/catalog-list.ts` (`CATALOG_VIEWS` maps the views to
  the kinds `building`, `research`, `ship`, `defense`): the title, the line
  below it, the orders of the shipyard and the lock notice, or the notice
  why the planet has no list; then one row per entry of the catalog table
  of the kind (the buildings filtered by `placement`, #53) with its texts,
  icon, explanation, level, cost with the energy of `energyThreshold`, the
  lines (energy and use of the next level, stats of `combat` and `mobile`,
  time) and its action. It replaces `Buildings.svelte`, `buildings.ts`,
  `views/economy.ts` (research), `views/yard.ts` and `itemHTML()` of
  `views/common.ts`. A list is mounted once per view and updated on every
  render (`flushSync`); a fresh render mounts it again, as the HTML views
  render anew, so no number typed into the shipyard stays on another
  planet. The clock moves `client.shown` to the planet of now every second
  for a mounted list, which replaces `updateResearchButtons` and
  `updateShipyardButtons`, and leaves the countdowns of the list to it.
  `lockNotice()` with its comparison with `yard` moved from `yard.ts` to
  `catalog-list.ts`; the allow-list entry of #183 moved with it.
* **[E]** Review of #209 (2026-11-14), each with a test that failed
  before: an action answers `done`, `stale` (it went through, but the
  player left the planet meanwhile) or `failed`; `order` and `send` clear
  their form only on `done` (`actHere` in `main.ts`), so the answer of an
  order on one planet no longer clears the field of another (the base did,
  through `stillOnPlanet` and a `true`). A refresh applies its state only
  when it is the newest one and no action was on its way or started while
  it ran (`sync.refresh()`), so it never brings back a state older than an
  action's answer (the base had this race too); the next refresh follows
  within 4 seconds. The energy a level of a building needs is compared
  with `production()`, as `energyShort()` checks it, not with `prod()`:
  with a throttled Fusionskraftwerk the row showed enough energy while the
  button said „Zu wenig Energie“. The old `Buildings.svelte` had the same
  mismatch, so this is a change of behaviour; its frozen copy for the
  reference test has the same one change, marked.
* **[E]** All four lists follow the clock (owner, 2026-11-14, #118,
  option C „Alle live + Changelog“): in Forschung, Schiffsschmiede and
  Verteidigung the costs and the lists „Benötigt“ now update every second
  as in Gebäude (before, only the buttons and the maxima did), and a
  clicked button keeps its focus, because the list is updated in place;
  not chosen: copying the old split (costs from the last render, buttons
  from the clock), or the same without a changelog entry. The pull request
  brings the fragment `changes/listen-live.md` (`art: geändert`).
* **[E]** Order after the lists (owner, 2026-11-14, #118 „Geklärt,
  Nachtrag 2“): next come the views that the phone view #189 builds on,
  the Übersicht, the header, the Sternenkarte and the navigation (tab bar
  and „Mehr“); **[V]** one view per pull request, and no two views of #118
  are built in parallel.
* **[E]** Built with #118, second pull request (the Übersicht):
  `src/client/views/Overview.svelte`, mounted by `mountOverview()`
  (`src/client/views/overview.ts`), renders the overview from
  `overviewPage(v)` of `src/client/logic/overview.ts`: the title, the
  fleet movements (`fleetRows()`, the owner of a foreign fleet as a bold
  part, the recall of an own fleet but not of the gift of #161), the
  planet or moon with its picture, kind, position, type, temperature,
  diameter with the fields, points with the place, the server time of the
  render, and the activities (`activityRows()`: building, research, the
  next unit of the shipyard). It replaces `overview()` of
  `views/overview.ts`; the fleet view builds its list „Flotten unterwegs“
  from the same `fleetRows()` (only the player's own fleets) and stays
  HTML. Unlike the lists, the overview is mounted anew on every render,
  as its HTML view was rendered anew: the clock of `main.ts` keeps
  counting its countdowns down and marking the ones that fired
  (`data-fired`), and the focus behaves as before, so nothing visible
  changes; `client.shown` is not moved by the clock for it, so
  „Serverzeit“ stays the time of the render. A view that is neither a
  Svelte view nor an HTML view gets the overview, as before.
* **[E]** Settled by package 8 (2026-11-20, [section 13](13-client-features.md)):
  `main.ts` is the frame of 30 lines and keeps no state. The rest of this
  bullet is the history of the earlier pull requests of #118. Left in
  `main.ts` then: the login
  (`loginChallenge`, `rememberLogin`, `resetToken`), the admin panel
  (`adminPanel`), the mounted Svelte view (`mounted`, a DOM handle),
  `lastActivity`, the install offer (`installPrompt`, `installedHere`,
  `installDismissed`), the news (`newsLoading`, `newsLoad`), the
  maintenance banner (`maintenance`), `planetRequest`, `readPending` and
  `announcementPending`; `client.ui` is not reactive yet, and the
  resources page still gets its view state through a store. The second
  pull request (the Übersicht) moved no variable of this list: the old
  view kept no state in `main.ts`; `mounted` now also holds the overview.
  Bundle 1 (header line, navigation, resource bar) moved none either: the
  old frame kept no state in `main.ts`; `renderMenu` still clears the dot
  of the news (`seeNews`) before it shows the navigation, and `updateBar`
  still returns the planet moved to now for the clock. Bundle 2 (the
  Sternenkarte) moved none either: the old view kept its state in
  `client.ui` (`gal`, `sys`, `gmoon`, `scan`), which stays there;
  `mounted` now also holds the Sternenkarte. Bundle 3 (Flotte) moved none
  either: the old view kept its state in `client.ui` (`ft`, `fm`,
  `union`), which stays there; `mounted` now also holds the fleet view.
  Bundle 4 (Nachrichten, Neuigkeiten) moved none either: the old views kept
  `client.ui.openRep` and `client.ui.news`, which stay there. Bundle 5
  (Highscore, Achievements) moved none either: the old views kept
  `client.ui.highscore` and the folds of #189 (`unfolded` of
  `logic/achievement-fold.ts`), which stay there. Bundle 5, second part
  (Optionen) moved none either: the old view kept the input of its fields
  in the DOM, which `keepInputs()` of `main.ts` still carries over a
  render. Bundle 6 (Gilden) moved none either: the old view kept
  `client.ui.guild`, which stays there; the dialog function `modal()` moved
  from `main.ts` to `src/client/modal.ts`. Still rendered as HTML: the view
  Admin (Marktplatz and Freunde, which came after the bundles were proposed,
  are components since the bullet below; they moved none either).
* **[E]** Bundle 3 after bundle 2 (owner, 2026-11-15 and 2026-11-16: the
  order of the bundles of #118 „Geklärt, Nachtrag 3“, unchanged by
  „Nachtrag 4“): Flotte, which the earlier work paused (the branch
  `claude/fleet-svelte`, built on #250) while #253, #292, #225, #93, #230
  and #55 changed the view; it is converted on their state, not merged.
* **[V]** Built with #118, bundle 3 (Flotte): `src/client/views/Fleet.svelte`,
  mounted by `mountFleet(target, v)` of `src/client/views/fleet.ts`
  (which renders no HTML any more, and leaves `VIEWS` of
  `views/index.ts`), renders the view from `fleetPage(v)` of
  `src/client/logic/fleet.ts`, without HTML: the title with the used and
  free slots (the gift of #161 and missiles take none) and the expeditions
  of #93; the fleets on their way (`FleetMoves.svelte`, which the overview
  uses too instead of its own table); the box „Verbandsangriff“ of #225
  (the rows of `logic/union.ts` with their countdowns); the ships that can
  fly with „max“, „alle Schiffe“ and „keine Schiffe“, or the notice
  without any; the form „2. Ziel und Auftrag“ with the list „Schnellwahl“
  (#253, #292), the target (the one of the Sternenkarte, `ui.ft`, or the
  shown planet; „Mond“ only where one is, #53; the field „Position“ up to
  the expedition position of #93), the list „Auftrag“, the note on the
  limit of planets (#237), the row „Verband“, the row of the time at the
  target, the speeds, the cargo fields each with its „alles“ and „alles
  (gleichmäßig)“ (#240), the empty cells of the preview and „Flotte
  losschicken“; and the box „Warp-Tor“ of #230 (`jumpPanel()`). The data
  come as a property (`page`), as for the Sternenkarte. Two parts are HTML
  in the component (`{@html}`) because `features/fleet.ts` writes them again
  while the player types, and both must come from the same function: the
  options of the list „Auftrag“ (`missionOptions()` of `fleet-target.ts`)
  and the row of the time at the target (`timeRowHtml()`, which with
  `holdRow()`, `timeRow()` and `realStay()` moved from `views/fleet.ts` to
  the new `logic/fleet-time.ts`). `quickOptions()` is gone: the component
  renders the options of „Schnellwahl“ itself. The view is mounted anew on
  every render (`ANEW`), as its HTML was rendered anew: `keepInputs` keeps
  the typed numbers, the chosen target, mission and speed and the focus by
  id, and the clock counts the countdowns down, as before. Reading the
  form, the preview and the click actions stay in `features/fleet.ts`; the
  box and the row of the unions lost their HTML (`views/union.ts` is gone).
  `main.ts` no longer names a view that is a component: the table of which
  views are components and how each is mounted (`MOUNTED`, `ANEW`,
  `mountView()`) is `src/client/views/mount.ts`, so a view that moves to a
  component is added there, not in `main.ts` (1,222 to 1,191 lines). No
  visible change.
* **[E]** Bundle 4 after bundle 3 (owner, 2026-11-15 and 2026-11-16: the
  order of the bundles of #118 „Geklärt, Nachtrag 3“, unchanged by
  „Nachtrag 4“): Nachrichten and Neuigkeiten.
* **[V]** Built with #118, bundle 4: `Messages.svelte`, mounted by
  `mountMessages()` of `views/messages.ts`, renders the list of reports
  from `messagesPage(v)` of the new `logic/messages.ts`: the count, „Alle
  löschen“, each report newest first with its title, time, the marks `new`
  and `open`, and its body, which is a text, an update message (its lines
  and the link to „Neuigkeiten“) or the values of a battle, espionage or
  survey report. The bodies of these reports were HTML at first
  (`reportBodyHTML()`, rendered with `{@html}`); since #330 they are
  components, see the next entry. `News.svelte`, mounted by `mountNews()` of
  `views/news.ts`, renders „Neuigkeiten“ from `newsPage()` of
  `logic/news.ts` (`newsHTML()` and `updateMessageHTML()` are gone; the
  link of the update message is `UPDATE_LINK`). Both views leave `VIEWS` of
  `views/index.ts`, are added to `views/mount.ts` and are mounted anew on
  every render (`ANEW`), as their HTML was rendered anew: an opened report
  stays open (`client.ui.openRep`, toggled by `features/reports.ts`) and
  the news render again once they have loaded. No visible change.
* **[V]** Built with #330 (the bodies of the reports as components, no
  visible change, `{@html}` gone from `Messages.svelte`): `reportBody()`
  of `logic/report-body.ts` turns a stored battle, espionage or survey
  report into plain values (`BattleBody`, `SpyBody`, and `SurveyBody` of
  `surveyReport()` in `logic/survey.ts`: the lines, the rows of the unit
  tables, the sections with their lists, and `null` where a part is
  missing), and `ReportBody.svelte` hands them to `BattleReport.svelte`
  (with `UnitTable.svelte`), `SpyReport.svelte` or `SurveyReport.svelte`,
  which only render. A player's text (planet, player and guild names)
  reaches the page as text; no value was shown as HTML on purpose (what
  the old strings did not escape were numbers and words of the game). The
  old functions are deleted; the frozen copy lives in
  `src/test/report-body-reference.test.ts`, which compares it with the
  components on generated reports of every kind (seed 330, sampled once)
  and hand-built cases, among them the shapes older versions stored
  (battle reports without tech, loot, debris, moon, `held` or `attackers`;
  espionage reports without `activity`). `Messages.svelte` and its
  reference test take the bodies from `ReportBody.svelte` too.
* **[E]** Scope of #330 (D1): only the report bodies; the other `{@html}`
  pieces (the option list and time row of `Fleet.svelte`, the options and
  preview of `Market.svelte`, the guild profile of `Guilds.svelte`,
  `costHTML`/`requirementsHTML` of `CatalogList`) stay as they are and get
  an issue of their own later (owner, 2026-11-21, through the coordinator).
* **[E]** Bundle 5 after bundle 4 (owner, 2026-11-15 and 2026-11-16: the
  order of the bundles of #118 „Geklärt, Nachtrag 3“, unchanged by
  „Nachtrag 4“): Highscore, Achievements, and Hilfe & Optionen.
* **[V]** Built with #118, bundle 5, first part (Highscore, Achievements;
  „Hilfe & Optionen“, now „Optionen“, follows in its own part):
  `Highscore.svelte`, mounted by `mountHighscore()` of `views/highscore.ts`,
  renders `highscorePage(v)` of `logic/highscore.ts`: the buttons of the
  categories (#78), the table `.scores` with each player's place, name, home
  planet (a planet, never a moon, #53, with its link to the system) and
  points, and the note below. `Achievements.svelte`, mounted by
  `mountAchievements()` of `views/achievements.ts`, renders
  `achievementsPage(v)` of the new `logic/achievements.ts`: the title
  („Achievements“, or „Belohnungen“ in a round with the daily reward only),
  the box of the daily reward (#220), the filter (search, category, status)
  and the groups „Einlösbar“, „Offen“ and „Erledigt“ with the fold of the
  phone (#189: `data-later` on the entries after the next goal of a series,
  `data-fold` and `data-all` on the group, the button `achFold`). The markup
  is that of the HTML views, so the rules of `style.css` for `.scores` and
  the fold keep working, and `features/achievements.ts` still reads the
  filter by ids and the marks `data-achievement`, `data-category`,
  `data-status` and `data-search`. Both views leave `VIEWS` of
  `views/index.ts`, are added to `views/mount.ts` and are mounted anew on
  every render (`ANEW`), as their HTML was rendered anew: the filter is
  applied again after each render (`afterRender`), and the folds stay in
  `unfolded`. `highscoreButtonsHTML()` and the two HTML functions are gone;
  `homeCell()` of `views/common.ts` went with the buddy list (below). `main.ts`
  stays at 1,191 lines: neither view had code in it. No visible change.
* **[V]** Built with #118, bundle 5, second part („Optionen“, formerly
  „Hilfe & Optionen“, view `help`): `Options.svelte`, mounted by
  `mountOptions()` of `views/options.ts`, renders `optionsPage(v)` of the
  new `logic/options.ts`, in its boxes: the choices (probes per Auspex
  exploration, the „(?)-Symbol“, the „Stufenübersicht“ of #187), „Hauptplanet“
  (#221, `mainPlanetBox()`), „Urlaubsmodus“ (#223), „Meine Aktivität &
  Spielzeit“ (#231), „Rundenarchiv“ (#235), „Darstellung“, „Passwort ändern“,
  „Passkeys“, „App installieren“, „Benachrichtigungen“ (the push kinds of
  #192, `pushKinds()`, only on a server with Web Push) and „Browser-
  Benachrichtigungen“, „Problem melden“, „Account löschen“ and the link to
  „Dieses Universum“ of the Lexicanum (#288). The frame of a box is the new
  `Box.svelte`. The ids and the `data-act`s are those that the features
  read (`options.ts`, `playtime.ts`, `passkeys.ts`, `install.ts`, `push.ts`,
  `report-problem.ts`, `round-archive.ts`) and `main.ts` (the forms
  `passwordform`, `o_anim`, `data-chg="push"`). What a feature fills after
  the render stays a plain element of the component: `#own-activity` (filled
  by `playtime.ts` from `GET /api/own-activity`), `#passkey-list` and the
  hidden button `#pwa-install` (shown by `install.ts`). The view leaves
  `VIEWS`, is added to `views/mount.ts` (`help`) and mounted anew on every
  render (`ANEW`), as its HTML was; the rendering of the archive comes from
  `archiveHTML()` of `logic/round-archive.ts` as markup (`{@html}`),
  because the admin box „Rundenberichte“ shares its report, list and history
  and stays HTML until the Admin bundle. The boxes of the lock screen of the
  vacation mode (`passwordBox()`, `passkeysBox()`, `notificationBoxes()`,
  `deleteAccountBox()` of `views/misc.ts`) are still HTML, so they stay
  there; they share the sentence of „Account löschen“ with the component
  (`deleteAccountText()`) and the push kinds (`pushKinds()`, from which
  `pushKindsHTML()` is built). `help()` and the HTML of the options of
  `explain.ts`, `level-mode.ts`, `main-planet.ts`, `vacation.ts` and
  `own-activity.ts` are gone. `main.ts` stays at 1,191 lines: the view had
  no code in it; its handlers (`o_anim`, `passwordform`) go to the
  component with package 8. No visible change.
* **[E]** Bundle 6 after bundle 5 (owner, 2026-11-15 and 2026-11-16: the
  order of the bundles of #118 „Geklärt, Nachtrag 3“, unchanged by
  „Nachtrag 4“): Gilden, after #169.
* **[V]** Built with #118, bundle 6: `Guilds.svelte`, mounted by
  `mountGuilds()` of `views/guilds.ts`, renders `guildsPage(v)` of the new
  `logic/guilds.ts`: the directory with the form to found a guild, or the
  page of one guild: profile, points, members (`GuildMembers.svelte`: the
  rank and, by the own rank, „Leitung übergeben“, „Rang ändern“ with the
  class `rank-select` of #277, „Entfernen"), the chat box (`GuildChat.svelte`
  with `ChatLog.svelte`, #169), „Bewerben“ / „Gilde verlassen“ / „Gilde
  auflösen“, the admin's „Chat lesen“, and for the own guild the
  applications, the ranks (`GuildRanks.svelte`, #163: editor, rights as
  checkboxes with `data-rank-right`, the order, default and deleting) and the
  profile form (`GuildProfileForm.svelte`). Every decision of the old view
  (what the own rank may see and do, by `core/guild-ranks.ts`) is made in
  `logic/guilds.ts`; the components only render. The three dialogs
  (`GuildDialogs.svelte`: hand-over, dissolving, the admin's chat) are
  components too: `modal()` (now `src/client/modal.ts`, out of `main.ts`)
  takes HTML or a `Dialog` (a function that mounts into `#modalIn` and
  returns how to unmount) and takes the earlier one down whenever it shows
  anything, so `modal('')` still closes. The view is mounted anew on every
  render (`ANEW`), as its HTML was: `keepInputs` (inputs by id, the ticked
  rights by `data-rank-right`, `data-nokeep` of the dissolve field),
  `keepChatScroll` (`.chat-log`) and the draft of the chat work on the new
  markup as before; the ids, `data-act`, form ids and `data-*` hooks are those
  of the HTML view (pinned in `src/test/guilds-reference.test.ts`). A field
  now gets its value as a property, not as the attribute `value`; nothing
  reads the attribute. `box()` of `common.ts` stays for the other HTML views;
  `Box.svelte` is its component. `main.ts` 1,191 to 1,186 lines. No visible
  change.
* **[E]** Bundle 7 (owner, 2026-11-19, #118 „Geklärt“: in the update of
  2026-11-22; package 8 follows): Admin, with the login and the install state.
* **[V]** Built with #118, bundle 7: `Admin.svelte`, mounted by `mountAdmin()`
  of `views/admin.ts`, renders `adminPage()` of the new `logic/admin.ts`: the
  tabs, the settings of the universe (the live settings of the round among
  them, `settingRow()`), the invitation with its link, the box „Endzeit“,
  „Rundenberichte“, „Neue Runde“ and „Servernachricht“. The round archive is
  `RoundArchive.svelte` (`archivePage(state, admin)` of `logic/round-archive.ts`),
  used by „Optionen“ and the admin, so `{@html}` is gone. The dialogs
  „Neue Runde“ (`RoundDialog.svelte`, `roundDialogPage()`; the field of each
  setting of the registry, a fieldset per group, the wrapper
  `[data-round-field]` and the preview line that `features/round.ts` keeps
  current) and „Endzeit einläuten“ (`EndzeitDialog.svelte`) are `Dialog`s of
  `modal()`. The login and registration are `Auth.svelte` (`authPage()` of
  `logic/auth.ts`), mounted by `renderLoggedOut`. The panels that load from
  the server are components too (after bundle 7): `AdminDiagnostics.svelte`,
  `AdminErrors.svelte` and `AdminInvitations.svelte`, with `AdminTable.svelte`
  and `AdminPager.svelte`, from the pure `logic/admin-panels.ts`. What they
  loaded, what was typed into their filters and the tab that is shown are the
  state of `logic/admin-panels.svelte.ts`, which also holds the calls and the
  arrow keys; it stays over a render (the page is mounted anew each time) for
  the same admin. `features/admin.ts` holds the handlers (`adminTab`, `revoke`,
  the forms `inviteform` and `announceform`), `features/login.ts` the steps of
  the login with their state `login` of `logic/login.ts` (`resetToken` is read
  by `apply()` in `main.ts`). `ClientCtx` gained `apply` and `signedOut`. The view registers itself with `clientViews` in `views/admin.ts` (menu order 180, shown to an admin), so `mount.ts` and `VIEWS` name it no more. The
  fields of the settings stay `data-nokeep`; the draft of what the admin typed
  (`logic/settings-draft.ts`) is put back by `afterRender` as before. The ids,
  `data-act`s, form ids and `data-*` hooks are those of the HTML (pinned in
  `src/test/admin-reference.test.ts`, `auth-reference.test.ts` and
  `round-archive-reference.test.ts`). The install state was already in
  `features/install.ts`. `ADMIN_TABS` is still exported by `views/misc.ts`
  because `e2e/phone-overflow.spec.ts` imports it there. `main.ts` 1,186 to
  888 lines. Package 8 still has: transport, maintenance, toasts, „Problem
  melden“, the click table and the remaining forms (account deletion, chat,
  etc.). No visible change.
* **[E]** Marktplatz (#171) and Freunde (#227) are part of the update of
  2026-11-22 (owner, 2026-11-19, „Geklärt“ on #118): both views become
  components, with no change of a game rule, a text or the look.
* **[V]** Built with #118, bundle 7, second part (Marktplatz, Freunde):
  `Market.svelte`, mounted by `mountMarket()` of `views/market.ts`, renders
  `marketPage(v)` of the new `logic/market-page.ts`: the notice while the
  market is off for the round, no prices came, or the planet has no
  Handelsposten, else the form (what to give, what to get, the amount with
  „max“, the preview, „Tauschen“). The draft stays `draft` of
  `logic/market.ts` and the typed values stay with `keepInputs()` of
  `main.ts` (by id), as before; `features/market.ts` still reads the form by
  its ids and writes the list of what to get and the preview into
  their places while the player types, so those two lists and the preview
  are HTML in the model (`targetOptions()`, `previewHTML()`, moved from
  `views/market.ts` to `logic/market-page.ts`) and `{@html}` in the
  component, as the target and the preview of the fleet form are.
  `gainWarning()` of `logic/market.ts`, which the admin settings use too,
  is untouched. `Friends.svelte`, mounted by `mountFriends()` of
  `views/friends.ts`, renders `friendsPage(v)` of `logic/friends.ts`: the
  table `.friends` (name, guild tag, home planet with its link, online or
  offline, „Freundschaft beenden“), the requests both ways and the form
  „Freundschaft anfragen“; the buttons carry `data-act="friend"` with
  `data-op` and `data-uid`, which `features/social.ts` reads. The link to a
  planet is `HomeCell.svelte` (from `homeLink()` of `logic/friends.ts`),
  which `Highscore.svelte` uses too instead of its own copy; `homeCell()` of
  `views/common.ts` is gone. Both views leave `VIEWS` (only the admin
  remains there) and are mounted anew on every render (`ANEW`), as their
  HTML was. `main.ts` stays at 1,186 lines. No visible change.
* **[E]** Bundle 2 after bundle 1 (owner, 2026-11-15 and 2026-11-16: the
  order of the bundles of #118 „Geklärt, Nachtrag 3“, unchanged by
  „Nachtrag 4“): the Sternenkarte, which the phone view #189 builds on
  too.
* **[V]** Built with #118, bundle 2 (the Sternenkarte; bundle 1 is
  described below): `src/client/views/Galaxy.svelte`, mounted by
  `mountGalaxy(target, v)` of `src/client/views/galaxy.ts` (which renders
  no HTML any more, and leaves `VIEWS` of `views/index.ts`), renders the
  view from `galaxyPage(v)` of `src/client/logic/galaxy.ts`: the fields
  „Galaxie“ and „System“ (`data-nokeep`) with their steps, „Anzeigen“ and
  „zum Heimatsystem“; the panel of the last scan (#53) with its
  countdowns (`countdown()` of `overview.ts`, rendered by the new
  `Due.svelte`, which the overview now uses too instead of its own
  snippet, so the copy check jscpd finds no clone); one `GalaxyRow` per
  position: the planet (`GalaxyPlace`: name, owner, place in the
  highscore, noob protection, actions), the symbols of the moon and the
  Trümmerfeld (#45, #53), the actions of a free position and the row of
  the open moon; and the Spähschädel of a spying. The actions are data
  (`GalaxyAction`: a link or a button with its attributes, `data-act`
  first, or the name of the shown place); the symbols of the moon and the
  Trümmerfeld, the button „Bergung“ and the pictures keep their HTML of
  `moonMark()`, `debrisMark()`, `harvestButton()`, `moonPicture()` and
  `planetHTML()`, rendered with `{@html}` as the overview renders its
  pictures, so `logic/moon.ts` and `logic/debris.ts` stay as they are.
  The data come as a property (`page`), as for the frame. The view is
  mounted anew on every render (`ANEW` in `main.ts`, with the overview),
  as its HTML was rendered anew: `keepInputs` gives the focus back by id
  (the field „System“ after Enter, the symbol of a moon), the typed system
  does not come back, `paintPlanets` paints the textures and the clock
  counts the countdowns of the scan down, as before. The click actions
  (`gnav`, `ggo`, `ghome`, `gmoon`, `gscan`, `gscanClose`, `gfleet`,
  `gspy`, `selectPlanet`) stay with `data-act` in `main.ts` until package
  8; `gfleet` and `gspy` read their target with `targetOf()` of
  `galaxy.ts`, so `main.ts` shrinks (1,875 to 1,873 lines). No visible
  change.
* **[E]** Bundle 1 next (owner, 2026-11-16; the bundles of #118 „Geklärt,
  Nachtrag 3“): the header line, the navigation (menu, tab bar and „Mehr“)
  and the resource bar, which the phone view #189 builds on.
* **[V]** Built with #118, bundle 1: each part of the frame around the view
  is a Svelte component in its old place of `index.html`, from a pure
  module of `src/client/logic/`, mounted by `src/client/views/frame.ts`
  (`showHeader`, `showNavigation`, `showResourceBar`, `clearFrame` when
  signed out):
  * `Header.svelte` (`#pinfo`) from `headerLine(s, P)` of `header.ts`: the
    shown place with its position, the commander, „Logout“ and, with more
    than one own place, the list „Aktiver Planet“ (`#planet_select`) of
    `ownPlaces()`, the shown place selected; since #241 the list comes
    first and replaces the name and position as text (below);
  * `Menu.svelte` (`#menu`), `TabBar.svelte` (`#tabbar`) and
    `MoreList.svelte` (`#more-list`), each link a `NavLink.svelte`, from
    `navigation()` of `navigation.ts`: the entries of `menu()` and
    `phoneMenu()` (`views/index.ts`), each with its address, whether it is
    open (`class="on"`, `aria-current="page"`) and the mark „!“ of
    `menuHints()` and the news; „Mehr“ open and marked when one of its
    views is;
  * `ResourceBar.svelte` (`#resbar`) from `resourceBar(game, planet, now)`
    of `resource-bar.ts`: Adamant, Psikristall and Promethium of the
    planet moved to now, each with its production per hour, its storage
    and the mark of a full one, and the energy left over and produced.

  The components get their data as properties, not from the state module:
  `client.ui` is not reactive yet, and `client.shown` follows only the
  mounted views. Each part is mounted anew whenever `main.ts` showed it as
  HTML before (the header line and the navigation on every render, the bar
  on every render and every second of the clock), as its HTML was written
  anew: a focused link or the list „Aktiver Planet“ loses its focus on a
  render and the title of the bar is replaced every second, as before, so
  nothing visible changes. `data-act` (`nav`, `moreOpen`, `logout`) and the
  `change` of `#planet_select` stay with the handlers of `main.ts`.
  Updating the frame in place instead is left to a later decision (for
  example with #189). The double display of the active planet (#241) is
  left as it is: the issue is separate, and this bundle changes nothing
  visible.
* **[V]** Built with #241 (see [Interface](/features/interface.md)):
  `Header.svelte` renders the list „Aktiver Planet“ first when
  `headerLine()` gives places, else the name in bold and the position;
  then „ · Kommandant … · Logout“ in both cases. `headerLine()` is
  unchanged. The frozen header of `src/test/frame-reference.test.ts` has
  this one change, marked, as the frozen `Buildings.svelte` has the one of
  #209; the property test still compares every other state with it.

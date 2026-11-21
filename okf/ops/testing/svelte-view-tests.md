---
type: Policy
title: 'Reference tests of the Svelte views'
description: 'The property and reference tests of the views converted in #118, list by list and bundle by bundle.'
---

# Reference tests of the Svelte views

* **[E]** The four lists of #118: the property test
  `src/test/catalog-list-reference.test.ts` keeps `CatalogList` equal to
  the views before #118 (frozen there: `research()`, `shipyard()`,
  `defense()` and `itemHTML()`; and the copy
  `src/test/catalog-reference/Buildings.svelte`) on generated states (150
  per list, fast-check seed 118), up to what a browser does not show:
  Svelte's comments, the order of the attributes, the escaping of `>`,
  `"` and `'`, the `<tbody>` a table gets anyway and white space next to a
  block or a line break. An escaped `<` and `&` stay escaped, so a name
  shown as text never equals the same name as markup (review of #209: a
  list that shows the planet name unescaped fails the test; with the
  earlier decoding of every entity it passed); the frozen
  `Buildings.svelte` has one marked change, the energy of a level from
  `production()` (review of #209); a third case checks that the generated states reach every action
  and notice. Checked by breaking the component (an attribute, a space
  between two inline elements). jscpd leaves the frozen copy out
  (`.jscpd.json`), as it leaves out the test files.

* **[E]** The Übersicht of #118 (second pull request): the property test
  `src/test/overview-reference.test.ts` keeps `Overview` equal to the
  view before (frozen there: `overview()` and `fleetTable()` of
  `src/client/views/overview.ts`) on 300 generated states (fast-check seed
  118: planets and moons, names with markup, foreign, own, returning and
  gift fleets of every mission, unknown owners and ships, the three
  queues, players missing from the highscore), with the same normalizer
  as the lists, now shared in `src/test/markup.ts`; it decodes `&quot;`
  only in the text between the tags and keeps it escaped in an attribute
  value, so an escaped quote never equals the end of the value and the
  start of another attribute (CodeRabbit on #210: before, `alt="x&quot;
  title=&quot;y"` equalled `alt="x" title="y"`); the generated names
  include one that turns into an attribute in `alt` without that escaping,
  and the moon picture is frozen with the view; a second case keeps
  the list „Flotten unterwegs“ of the fleet view equal to the frozen
  `fleetTable()`, and a third checks that the cases reach every branch.
  Checked by breaking the component (an attribute, the space before
  „(nächste)“, a name as markup, the recall, a space before
  „(umbenennen)“). The pure logic has its tests in
  `src/client/logic/overview.test.ts`, the component in
  `src/client/views/overview.test.ts`.

* **[V]** The frame of #118, bundle 1: the property test
  `src/test/frame-reference.test.ts` keeps `Header`, `Menu`, `TabBar`,
  `MoreList` and `ResourceBar` equal to the HTML before (frozen there:
  `renderPlanetHeader()`, `menuBadge()`, `menuLink()`,
  `renderPhoneMenu()`, `renderMenu()` and `updateBar()` of
  `src/client/main.ts`) on 300 generated states (fast-check seed 118: up
  to five own and foreign planets and moons with names that hold markup or
  quotes, an admin or not, every round rule, unread reports, rewards,
  incoming fleets, guild applications and chat, finished work with markup
  in its mark, news seen or not, every view open, and planets with full
  storage, too little energy and falling Promethium), with the shared
  normalizer of `src/test/markup.ts`; a fourth case checks that the cases
  reach every branch. The normalizer now also leaves out an empty `class`,
  which Svelte does not write, and reads `selected=""` as `selected`;
  its self-test in `catalog-list-reference.test.ts` has both, and that a
  class of a space or an empty `data-class` still differs. Checked by
  breaking the components (the space before „·“ of the list, the space in
  `class="v "`, `aria-current`). The pure logic has its tests in
  `src/client/logic/header.test.ts`, `navigation.test.ts` and
  `resource-bar.test.ts`, the components in `src/client/views/frame.test.ts`.

* **[V]** The Sternenkarte of #118, bundle 2: the property test
  `src/test/galaxy-reference.test.ts` keeps `Galaxy` equal to the HTML
  before (frozen there: `galaxy()` of `src/client/views/galaxy.ts` with
  its helpers, and `cd()` of `views/common.ts`) on 300 generated states
  (fast-check seed 118: planets, moons alone and planets with their moon
  of up to five owners, one unknown, with names that hold markup or
  quotes, Trümmerfelder, the shown planet or moon in the list or not,
  with a phalanx of level 0 to 4 and colony ships, players around the
  noob protection, the shown system or another, an open moon here or
  elsewhere, a scan from here or from another place with up to three
  flights, and 0 to 1,500 Spähschädel), with the shared normalizer of
  `src/test/markup.ts`; a second case checks that the cases reach every
  branch. The normalizer then also read `data-nokeep=""` as
  `data-nokeep`, which `main.ts` read by its presence (the attribute is gone
  since #332; the normalizer now drops it); its self-test in
  `catalog-list-reference.test.ts` has that, and that a missing
  `data-nokeep` or one with a value still differs. Checked by breaking
  the component and its logic (the space before „·“, the space before a
  symbol, the space in `class="moon-row "`, `data-nokeep`, `tabindex` of
  the scan's heading, the „(n)“ of the noob protection, the rank „-“,
  the `aria-label` of the scan, the open moon). The pure logic has its
  tests in `src/client/logic/galaxy.test.ts`, the component in
  `src/client/views/galaxy.test.ts` (the tests of the HTML view, now on
  the component). `e2e/galaxy.spec.ts` (desktop and phone) checks what
  `main.ts` does around the mounted view: the fields show the shown
  system, the focus stays in „System“ after Enter, a step with ▶,
  „zum Heimatsystem“, the textures of the planets, „Wechseln“ at a
  colony and, on a phone, no scrolling to the side; it fails when the
  view is not mounted anew.

* **[V]** The fleet view of #118, bundle 3: the property test
  `src/test/fleet-reference.test.ts` keeps `Fleet` equal to the HTML
  before (frozen there: `fleet()` of `src/client/views/fleet.ts` with its
  helpers, `unionBox()` and `unionFormRow()` of `views/union.ts`,
  `quickOptions()`, and `box()` and `cd()` of `views/common.ts`, as #93,
  #225, #230, #253 and #292 left them) on 300 generated states (fast-check
  seed 118: ships of every kind or none or only ones that cannot fly,
  research for the slots and the stay of an expedition, up to six fleets of
  four owners and three states with the gift, unions with leaders, invited
  and fleets, own moons with a Warp-Tor, friends, guild members and last
  targets for the list „Schnellwahl“, the target of the Sternenkarte or
  none as planet or moon, a chosen mission or an unknown one, a universe
  speed of 1 or 4), with the shared normalizer of `src/test/markup.ts`
  (which now also drops the empty marker `<!>` that Svelte writes for
  `{@html}` in a select); hand-built cases reach the Bergung with a
  Trümmerfeld, the button „Angriffsverband eröffnen“ and the hidden row of
  the holding time, which the sample reaches rarely, and a test checks that
  they reach them alone. The pure logic has its tests in
  `src/client/logic/fleet.test.ts`; the tests of the HTML view
  (`views/fleet*.test.ts`, `holding.test.ts`, `union.test.ts`) run on the
  component through `src/test/fleet-view.ts`, and
  `overview-reference.test.ts` checks the list of fleets of the fleet view
  on the component.

* **[V]** „Nachrichten“ and „Neuigkeiten“ of #118, bundle 4: the property
  tests `src/test/messages-reference.test.ts` and
  `src/test/news-reference.test.ts` keep the components equal to the HTML
  before (frozen there: `messages()`, `reportHTML()`, the plain body and
  `updateMessageHTML()`, and `newsHTML()`) on 300 generated states each
  (fast-check seed 118: reports of four types with texts that hold markup
  and line breaks, read and new, opened or not; news of up to three
  versions with entries of the three kinds), with hand-built cases for the
  empty states; the bodies of battle, espionage and survey reports are the
  same on both sides (first the functions of `logic/report-body.ts`, since
  #330 the components through `src/test/report-view.ts`), so only their
  wrapper is compared. The tests of the reports of holding
  (`holding.test.ts`) run on the component through
  `src/test/messages-view.ts`; the allow list of `catalog-keys.test.ts`
  names the new file of the report type „spy“.

* **[V]** The bodies of the reports as components (#330): the property test
  `src/test/report-body-reference.test.ts` keeps `ReportBody.svelte` (through
  `src/test/report-view.ts`) equal to the HTML before (frozen there:
  `reportBodyHTML()` with its helpers and `surveyBody()`) on 100 generated
  reports of each kind (fast-check seed 330, sampled once), with hand-built
  cases for names that hold markup and the shapes older versions stored, and
  a check that the cases reach every branch (`MARKS`). The unit tests of
  `report-body.ts`, `report-body-union.test.ts` and `survey.test.ts` assert
  on the values, no longer on markup.

* **[V]** The small components of #337: `src/test/html-pieces-frozen.ts` holds
  the HTML builders they replaced as they were (`costHTML()`,
  `requirementsHTML()`, `planetHTML()`, `moonPicture()`, `moonMark()`,
  `debrisMark()`, `harvestButton()`); the reference tests of the lists, the
  overview and the Sternenkarte import them from there, so a builder deleted
  from the code keeps its frozen copy. `src/test/html-pieces-reference.test.ts`
  keeps `Cost`, `Requirements`, `PlanetPicture` and `MoonPicture` equal to them
  on generated cases (fast-check seed 337; names with markup stay text) and
  hand-built ones (a waiting start button, an energy cost);
  `src/test/cost-views-reference.test.ts` checks that every cost line of
  `LevelTable` and `LexicanumArticle` equals `costHTML()` of the cost the
  model holds. A name with `<`, `&` or quotes is text of the component, never
  markup.

* **[V]** „Highscore“ and „Achievements“ of #118, bundle 5: the property
  tests `src/test/highscore-reference.test.ts` and
  `src/test/achievements-reference.test.ts` keep the components equal to the
  HTML before (frozen there: `highscore()` with `highscoreButtonsHTML()` and
  `homeCell()`, and `achievements()` with its helpers, `box()` and the fold
  of #189) on 300 generated states each (fast-check seed 118: players with
  markup in their names, scores or none, planets and moons of the players,
  every category and an unknown one; progress and claimed goals per series,
  the daily reward or none, a round with or without achievements, either
  group unfolded), with hand-built cases for the rare marks (a player with a
  moon only, equal points, no state of the page, the daily reward alone,
  every goal claimed with both groups unfolded); one test each pins the
  classes and marks that `style.css` and `features/achievements.ts` select.
  `normalize()` of `src/test/markup.ts` reads the marks of the achievements
  (`data-achievement`, `data-achievement-group`, `data-later`, `data-all`,
  `data-daily-reward`) without their empty value, as it does `hidden`: Svelte
  writes `data-all=""` where the HTML view wrote `data-all`. The tests of the
  views (`misc.test.ts`, `achievements.test.ts`) run on the components
  through `src/test/highscore-view.ts` and `src/test/achievements-view.ts`;
  the pure pages have their tests in `logic/highscore.test.ts` and
  `logic/achievements.test.ts`.

* **[V]** „Optionen“ of #118, bundle 5, second part: the property test
  `src/test/options-reference.test.ts` keeps `Options` equal to the HTML
  before (frozen there: `help()` of `views/misc.ts` with the HTML of the
  choices, the main planet, the vacation mode, the place of the play time,
  the push kinds and the account boxes; the box „Rundenarchiv“ and the form
  „Problem melden“ still call `archiveHTML()` and `reportFormHTML()`, which
  the admin and the dialog behind an error message use too) on 300
  generated states (fast-check seed 118: planets and moons of the player and
  of others with markup in their names, the main planet, a lock that is
  over, now or running, the choices with unknown values, rounds with and
  without guilds, push on or off with a pending choice, the minimum length
  of a password, page, version and request of the form), with hand-built
  cases for the rare marks (no planet, a lock, no push, no guilds, a pending
  push choice, an archive after an error and with rounds); one test pins
  the ids, `data-act`s and classes that the features, `main.ts` and
  `style.css` read. `normalize()` of `src/test/markup.ts` now also reads
  `checked` and `required` without their empty value and puts no white
  space next to `form`, `fieldset` and `legend`, which Svelte trims. The
  frozen link to the Lexicanum writes its `&` as `&amp;`, as Svelte does.
  The tests of the
  view (`misc.test.ts`) run on the component through
  `src/test/options-view.ts`; the pure page has its tests in
  `logic/options.test.ts`.

* **[V]** „Admin“, the login and the round archive of #118, bundle 7:
  `src/test/admin-reference.test.ts` keeps `Admin`, `RoundDialog` and
  `EndzeitDialog` equal to the HTML before (frozen there: `admin()`,
  `settingsForm()`, `invitations()`, `roundDialog()`, `endzeitDialog()`),
  `src/test/auth-reference.test.ts` the login screens (`auth()`) and
  `src/test/round-archive-reference.test.ts` `RoundArchive` (frozen in
  `src/test/archive-frozen.ts`, which `options-reference.test.ts` uses too),
  each on 300 generated states (seed 118) with `normalize()` and
  `textContents()` and hand-built cases (a used-up Endzeit, a round trip that
  gains, a hidden conditional field, a custom registry with a note, group
  preview and selection, every kind of round and report, every screen of the
  login). The text of a fieldset, a paragraph or a wrapper of the dialog is
  compared without spaces (the old template put its indentation there);
  every label, field and note is compared exactly. `textContents()` now
  leaves out `<tbody>` and `normalize()` reads `readonly` as a boolean. The
  tests of the dialog and the panel (`views/misc.test.ts`, `holding.test.ts`,
  `market.test.ts`) run on the components through `src/test/admin-view.ts`;
  the handlers have `features/admin.test.ts` and `features/login.test.ts`.
* **[V]** „Gilden“ of #118, bundle 6: the property test
  `src/test/guilds-reference.test.ts` keeps the components equal to the HTML
  before (frozen there: `guilds()` with its helpers, `transferDialog()`,
  `dissolveDialog()`, `adminChatDialog()` and `box()`) on 300 generated
  states (fast-check seed 118: up to three guilds with tags, names and
  profiles that hold markup, own guild or none or an applicant, a Leitung or
  any rank with any rights, ranks of 24 characters and older longer ones,
  members with or without a rank, a chat of messages and every kind of
  event, the admin or not) and 300 each for the three dialogs, with
  hand-built cases for the rare marks (the longest tag and name of #274, the
  Leitung against an officer against a rank without rights, no guild, guilds
  switched off for the round, a member in vacation, no open applications, a
  guild without a profile, a chat that only reads or only writes); one test
  checks that the cases reach every button of the page, one pins the ids and
  hooks the handlers read. `normalize()` of `src/test/markup.ts` reads
  `required` and `checked` as it does `hidden`, and ignores white space next
  to `form` and `h3`. The tests of the chat box (`views/guilds.test.ts`) run
  on the components through `src/test/guilds-view.ts`; the pages have their
  tests in `logic/guilds.test.ts`, the dialog in `src/client/modal.test.ts`.

* **[V]** „Marktplatz“ and „Freunde“ of #118, bundle 7, second part: the
  property tests `src/test/market-reference.test.ts` and
  `src/test/friends-reference.test.ts` keep the components equal to the HTML
  before (frozen there: `market()` with its options and preview, and
  `friends()` with `homeCell()` and `box()`) on 300 generated states each
  (fast-check seed 118: the market on or off, with or without prices, levels
  of the Handelsposten 0 to 6, limit and use of the day, fee and fee step,
  prices down to 0, stock and storage, every draft with amounts that hold
  markup or no number; players with markup in their names and tags, friends,
  requests both ways, planets and moons, guilds on or off), compared by
  `normalize()` and by `textContents()` of `src/test/markup.ts`, with
  hand-built cases for the rare marks (the market off for the round, no
  Handelsposten, the limit of the day reached and cutting an amount, the fee
  per level, a price at its lowest, an empty stock, a full storage; no
  friends, open requests both ways, a friend in vacation, the friend with the
  longest name, a player the state does not know). Each test pins the ids and
  hooks the handlers read. The tests of the views (`market.test.ts`,
  `friends.test.ts`) run on the components through `src/test/market-view.ts`
  and `src/test/friends-view.ts`; the pages have their tests in
  `logic/market-page.test.ts` and `logic/friends.test.ts`.

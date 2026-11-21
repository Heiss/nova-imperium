---
type: Architecture
title: '13. Client features register themselves'
description: 'A client feature exports its handlers as clientFeature from its own file; the list is generated and main.ts names none (#322).'
---

# 13. Client features register themselves (#322, part 1 of #317)

* **[E]** Decided by the owner (2026-11-19, #317): `src/client/main.ts`
  stops growing; a client feature registers itself like a round setting
  (#310). No change of the game, of a text or of the behaviour.
* **[V]** Built with #322 (main agent's proposal, the owner decided only that
  the pattern comes): a feature has one module
  `src/client/features/<name>.ts` that exports under the fixed name
  `clientFeature`, `export const clientFeature = { acts: (ctx) => ({ ... }) }
  satisfies ClientFeature;`. `acts` returns the `data-act` handlers of the
  feature: a name from the markup (`data-act="build"`) to a function that gets
  the `data-*` attributes of the element. `ClientFeature` and the context
  `ClientCtx` are in `src/client/features/contract.ts`.
* **[V]** `ClientCtx` holds only what moved code really needs from `main.ts`:
  `act` and `actHere` (send an action; `actHere` is true only on the place
  still shown, #209), `modal`, `go`, `render`, `api`, `toast` and `setInput`.
  The state is not in it: a module imports `client` from
  `logic/state.svelte.ts`, which also holds `client.ui`. `main.ts` builds one
  object and hands it to every module. A member is added when a module needs
  it, not before.
* **[V]** Two more members of `ClientFeature` exist, both optional, each
  added with the first module that needed it: `forms`, the submit handlers by
  the id of the form (the submit is stopped, then the handler runs; a form
  that clears itself with its own listener, as `abandon`, `market` and
  `social` do, needs none), and `afterRender`, which runs after each render at
  the place where `main.ts` called the fleet preview before. A module may also
  listen to the document itself when its `acts` is built (change, input,
  keydown, submit); `main.ts` builds the table once, at start.
* **[V]** The list of the modules is generated: `scripts/gen-features.ts`
  writes `src/client/features/index.gen.ts` (`CLIENT_FEATURES`, `[name,
  clientFeature]` pairs sorted by file name), not checked in (`.gitignore`),
  from every file of the folder that exports `clientFeature` (same detection
  and write-if-changed as for `roundSettings`; not a test, not a generated
  file). Knip takes it as an entry; Vitest coverage, Stryker and the
  dependency rules need no entry, as they do not look at `src/client/features`
  or at generated files. `main.ts` imports only this list and names no
  feature: it builds its tables from its own frame handlers (login, the
  planet choice, the admin panel, navigation, the click and key dispatch) and
  the handlers of all modules through `assembleActs` and `assembleForms`
  (`src/client/features/assemble.ts`), and calls `runAfterRender`.
* **[V]** The rules for all modules are checked in two places. The functions
  of `assemble.ts` throw when a handler name or a form id is defined twice,
  between two modules or between a module and a frame handler, so there is no
  silent overwrite by spread order and the page fails at start, not in one
  click. `src/client/features/registry.test.ts` checks every listed module
  (exports `clientFeature` with `acts`, plain names, no name twice) and the
  functions themselves; the frame handlers of `main.ts` are checked only at
  start, as `main.ts` cannot be imported in a test. Each module tests its own
  handlers with a fake `ctx` (`test-ctx.ts`): what a handler sends through
  `ctx.act` and what it shows, without DOM snapshots.
* **[V]** Small reads of the page that `main.ts` and the modules share are in
  `src/client/dom.ts` (`$`, `val`, `byId`, `setById`, `keepChatScroll`).
* **[V]** Built: `abandon`, `round`, `market`, `social`, `options`, `fleet`
  (with the fleet form and its preview), `missiles`, `lexicanum` and
  `demolition` (which delegates to `logic/demolition.ts`) were handlers
  outside `main.ts` before and are modules now, and the collecting file
  `feature-actions.ts` is gone; then moved out of `main.ts`: `guilds`,
  `galaxy`, `reports`, `passkeys`, `report-problem`, `admin` (the Endzeit, the
  settings and copying the link), `queue`, `rename`, `highscore`,
  `achievements`, `push` and `install`. What stays in `main.ts` is the frame:
  start, the API call, the state, the rendering, the login and its forms, the
  news and the maintenance banner, the admin panel and the click and key
  dispatch. Each move lowers the line count of `main.ts`, which is the limit
  of the next change (`size-ratchet.json` is gone, #317 part 4).

## Package 8 of #118: what is left of `main.ts` (owner, 2026-11-19)

* **[E]** Decided by the owner (#118, Nachtrag 4, 2026-11-16, and the
  comment of 2026-11-19): `main.ts` is only the entry point, and the parts
  that are not views have modules of their own; behaviour that lived only in
  `main.ts` survives.
* **[V]** Built: the transport is `logic/transport.ts` (`createApi`, with its
  tests: 401, maintenance, the retry of a busy action, errors) wired to the
  page in `api.ts`; the session (`session.ts`), the banner of a maintenance
  (`maintenance.ts`), the toasts with „Problem melden“ (`toast.ts`) and the
  error log (`error-log.ts`) are modules of their own. The state and the
  render are `sync.ts` (apply, act, refresh), `render.ts`, `completions.ts`,
  `news.ts`, `routing.ts`, `view-address.ts`, `dispatch.ts`
  (the click and submit dispatch with the context of the features),
  `clock.ts`, `boot.ts` and `ui-init.ts`. The frame handlers (sheet „Mehr“,
  dialog, planet choice, logout), the share of a producer, the animations,
  the activity sample and the marks „gelesen“ are the features `frame`,
  `producers`, `options`, `session-activity` and `reading`; a feature that
  only listens to the page returns no handlers.
  `ClientCtx` got `quiet` and `apply(state, fresh)`.
* **[V]** Forms own their input: „Account löschen“ is a component
  (`views/DeleteAccountDialog.svelte`) with its own password and busy state;
  the message of the guild chat and the name of a new buddy show a draft of
  `logic/drafts.svelte.ts`.
* **[E]** Owner, 2026-11-20 („all now“): `keepInputs` is gone and so is every
  `data-nokeep`. The uniform field drafts that shipped with the update
  (`logic/field-drafts.ts`, `field-drafts.ts`, `restoreFields` in `render.ts`)
  are deleted again (#332, 2026-11-21): every form that the poll redraws keeps
  its fields as the state of its component (section „Per-form component
  state“), and nothing restores a field after a redraw. A fresh render (another
  view or planet) and a logout drop that state, as they dropped the typed
  fields before. Fields without state show the state of the server: the
  settings of the universe (`logic/settings-draft.ts` keeps their draft), the
  link of the invitation and the confirmation of a dissolving (a modal outside
  `#view`); chat and buddy name have their own drafts
  (`logic/drafts.svelte.ts`). The amounts of the four lists (`q_<key>`,
  `td_<key>`) keep their value in the page: the lists are redrawn in place
  (`renderMounted`, they are not `anew`) and the two fields carry no value,
  binding or handler of the component, so the poll never writes or replaces
  them (`src/client/views/list-fields.test.ts`, E2E
  `e2e/redraw-drafts.spec.ts`).
* **[E]** Owner, 2026-11-20, made stricter by #332: no client code sets the
  value, tick or chosen option of a field, except `setField` of
  `src/client/dom.ts`, which `setInput` and `setById` use for the fields that
  hold their value in the page (the amounts of the lists, the settings of the
  universe). A field of a form with state is shown by its component and
  written through that state. The guard `src/test/field-writes.test.ts` reads
  the syntax trees of `src/client` (TypeScript and Svelte, tests excluded) and
  fails on `.value =`, `.checked =`, `.selectedIndex =`, `.selected =` (also
  `+=`, `++`, `["value"] =`) and `setAttribute('value', …)` anywhere but inside
  `setField`; it has no allow-list of files. A Svelte `bind:` or `value={…}` is
  no write. `normalize()` of `src/test/markup.ts` ignores `data-nokeep`, so the
  frozen HTML of the reference tests stays as it was. E2E:
  `e2e/redraw-drafts.spec.ts`.
* **[E]** Owner, 2026-11-20: `acts()` and `forms()` are free of side effects.
  A feature registers its page listeners (change, input, keydown, submit,
  window events) in the optional hook `listen(ctx)`, which the assembly calls
  once at start (`startListeners` in `assemble.ts`, called by `dispatch.ts`).
  `registry.test.ts` checks that every feature contributes something (acts,
  forms, `afterRender` or `listen`) and that building `acts` and `forms` adds no
  listener to the document or the window.

## Per-form component state (#332)

* **[E]** Owner, 2026-11-20 (#118, package 8, and #332): each form that the
  poll redraws keeps its fields as state of its component, so a redraw
  cannot lose them and no restore step is needed; when no form depends on
  the field drafts, `field-drafts.ts`, `logic/field-drafts.ts`,
  `restoreFields` and the allow-list entry of the guard are deleted. No
  visible change. Done on 2026-11-21: the last fields (the fleet form, part
  two) were converted, the drafts are deleted, and the guard has no allow-list.
* **[V]** The state of a form is a module of its own, as a view that is
  mounted anew loses what its component held: `formState()` of
  `logic/form-state.svelte.ts` (dropped by a fresh render and a logout,
  `forgetForms` in `render.ts`), or a `$state` of the form's own module
  where the form never dropped its draft (the marketplace,
  `logic/market-form.svelte.ts`). The component binds it and the handler
  reads and writes it. Built: the filter of the
  achievements (`logic/achievement-filter.svelte.ts`), the position of the
  Sternenkarte (`logic/galaxy-position.svelte.ts`), the marketplace, and the
  ships, position, speed, cargo and names to invite of the fleet form
  (`logic/fleet-form.svelte.ts`, read by `readFleetForm`, written by the
  handlers of `features/fleet.ts` and `features/union.ts`; a field of the
  position that nobody typed in shows the target of the page, `fleetTarget`
  of `logic/fleet-choice.ts`). Part two of the fleet form: the kind of target,
  the mission, the union, the holding time and the stay, and the „Zielmond“ of
  the Warp-Tor are state of the same module as well, and what the lists and the
  row of the time show for that state is worked out by one pure function,
  `fleetChoice()` of `logic/fleet-choice.ts`, which `Fleet.svelte` asks (the
  page gives it as `form.choose`) and the handlers read (`readFleetForm`):
  the list „Auftrag“ (`missionChoices` of `logic/fleet-target.ts`), the note of
  the limit of planets, the state of „Flotte losschicken“, the row „Haltezeit“
  (stay with its real time, or the holding time, hidden for a mission that
  does not hold), the moon option and the union all come from it, with no HTML
  string and no write into the DOM after a render. A field nobody touched shows
  the page (`ui.ft`, `ui.fm`, `ui.fk`, `ui.union`, which also carry the choice
  over to the next form of a fresh render); `fleetCalc` settles the state on
  every input (a moon that is not there goes back to the planet, the mission
  the list ended on is kept, the row of the other time starts again with 1
  hour). The „Schnellwahl“ has no state: it enters the target into the state
  and goes back to „– wählen –“. The list of missions follows the kind as asked
  and `fleetCalc` settles a moon that is not there before it reads the mission,
  so the first frame of a form that aims at a moon that is not there equals the
  frozen reference markup (`src/test/fleet-reference.test.ts`, unchanged).
  A handler that dispatches an input event after it
  wrote the state calls `flushSync()` first, else the component's `oninput`
  would read the old value back from the field. „Optionen“
  (`logic/options-form.svelte.ts`): the choices, the passwords and the text
  of „Problem melden“; a select shows the option chosen, else the one of the
  page (`isChosen`). The handlers still read the fields by id (the login
  shares `pw_next` and `pw_confirm`), which show the state; „Passkey
  hinzufügen“ and a sent report empty the state, so a redraw no longer puts
  the sent text back after `form.reset()`. „Gilden“
  (`logic/guild-form.svelte.ts`): the profile, the names of the ranks, the
  name of a new rank, the rank chosen for a member and the ticks of the
  rights; a disabled box shows the server (`ticked`, #163), and „Rang
  anlegen“ empties the name. `isChosen` (`form-state.svelte.ts`) is the
  option a select shows. With the rank boxes gone from the drafts, the drafts
  keep values only (no ticks). „Admin“ (`logic/admin-form.svelte.ts`): the
  address to invite and the message to all players, which a sent message
  empties; the filters keep theirs in `logic/admin-panels.svelte.ts`.
* **[V]** A number field whose state is a string takes `value={…}` with
  `oninput`, not `bind:value`. Checked against `bind_value` of Svelte 5.57
  (2026-11-21, with a fake input): `bind:value` stores the field as a number
  or `null`, and with a getter that has a fallback (the Sternenkarte shows
  the shown system while nothing is typed) it writes the fallback over a
  half-typed value (a browser reports `-` or `1e` as an empty value).
  `value={…}` writes the field only when the state differs from what the
  field holds (`set_value`), so a half-typed value stays. A select may use
  `bind:value`.

* **[V]** Taken by the coordinator under the rule of AGENTS.md, consistent
  with the owner's decision that each form keeps its state in its component
  (2026-11-21; the owner can overturn them):
  * the fix of „Problem melden“ (a sent text no longer comes back after the
    poll redraw) stays, with a changelog fragment, because the issue lists
    the `form.reset()` case as a defect;
  * the fleet form, part two: the mission list, the row of holding time and
    stay and the moon option are derived in `Fleet.svelte` from the state
    of the component; the frozen reference test is the judge (done, the
    reference test is unchanged);
  * the amounts of the four lists (`q_*`, `td_*`) do not depend on the
    drafts (a poll redraw does not mount them anew; a test shows it), so the
    drafts are deleted after the fleet form, part two; if the test shows
    otherwise for a field, the deletion stops (the test shows it, the drafts
    are deleted).

### Inventory: where each field keeps its value (2026-11-21, after the last conversion)

No field depends on the drafts any more. A field with an id inside `#view`
keeps its value in one of these places:

* **Flotte** (`Fleet.svelte`, mounted anew): all fields are state of
  `logic/fleet-form.svelte.ts`, dropped by a fresh render: `f_<ship>`, `t_g`,
  `t_s`, `t_p`, `t_v`, `c_m`, `c_c`, `c_d`, `un_name_<union>` (converted
  earlier today) and `t_k`, `t_m`, `t_u`, `t_h`, `t_stay` and `jg_to`
  (part two); `t_q` „Schnellwahl“ has no state to keep (see above). The
  handlers read what the form shows through `fleetChoice()`, not from the
  fields, as a read of the field right after a state change would see the
  old value (the component updates the DOM after the handler).
* **Optionen** (`Options.svelte`): `logic/options-form.svelte.ts` for `o_probes`,
  `o_explain`, `o_levels`, `o_main`, `pw_current`, `pw_next`, `pw_confirm`,
  `passkey-password` and `reportform-text`. `o_anim` and the push boxes are
  checkboxes whose state is the setting applied at once by
  `features/options.ts`.
* **Gilden**: `logic/guild-form.svelte.ts` for `guild_tag`, `guild_name`,
  `guild_description`, `rank_name_<rank>`, `rank_<rank>_<right>`, `rank_new` and
  `rank_of_<member>`. `chat_text` has its own draft (`logic/drafts.svelte.ts`).
* **Admin**: `logic/admin-form.svelte.ts` for `inv_email` and `announce-text`;
  `audit-player` and `audit-outcome` and the other filters keep theirs in
  `logic/admin-panels.svelte.ts`. `set_*` (`logic/settings-draft.ts`) and
  `inv_link` show the server.
* **Marktplatz**, the filter of the achievements and the position of the
  Sternenkarte: their own state modules (`logic/market-form.svelte.ts`,
  `logic/achievement-filter.svelte.ts`, `logic/galaxy-position.svelte.ts`).
* **Gebäude, Forschung, Schiffsschmiede, Verteidigung** (`CatalogList.svelte`):
  `q_<key>` (written by `features/queue.ts`) and `td_<key>` (emptied by
  `features/missiles.ts`) hold their value in the page, through `setField`;
  they are redrawn in place and never written by a render
  (`views/list-fields.test.ts`).

Fields with nothing to convert: „Freunde“ (`friend_name` has its own
draft); the search of the Lexicanum (no id, its state is
`views/lexicanum-state.svelte.ts`); the login (`Auth.svelte`: no signed-in
player, nothing to redraw); the list „Aktiver Planet“ (`planet_select`, in the
header); every dialog of `#modal` („Neue Runde“ `RoundDialog`,
`EndzeitDialog`, „Übergeben“ and „Auflösen“ `GuildDialogs`, „Account
löschen“, „Problem melden“, the missiles, renaming, abandoning): outside
`#view`. The redraw is checked by `e2e/redraw-drafts.spec.ts` (fleet,
marketplace, new guild, Sternenkarte, achievements, both filters of the admin,
the amounts of the lists).

## The actions are typed (#317, #118; owner, 2026-11-20)

* **[E]** Decided by the owner (2026-11-20, „jetzt komplett“): the call of an
  action is checked by the compiler against the input the server declares
  (`okf/architecture/patterns/14-server-features.md`, the map in
  `src/core/actions/`).
* **[V]** `act`, `actHere` and `quiet` of `ClientCtx` (and `Sync.send` and
  `Sync.quiet` of `logic/act.ts`) are `<K extends ActionName>(type: K,
  ...data: ActionArgs<K>)`: the name picks the type of the data, and the data
  may be left out only where every field of the input is optional. A name or
  a field that does not exist is a compile error at the call. The reads of the
  archive (`features/round-archive.ts`), which went through `ctx.api` by
  hand, use the same types. `data-act` names of the markup are the names of
  the handlers of the features, not action names, and stay strings. The
  handlers of the buddy list return a typed call (`FriendCall`), sent by
  `sendFriend` of `features/social.ts`, as a union of tuples cannot be spread
  into a generic call.
* **[V]** The state is typed the same way: `GameState` of `logic/types.ts` is
  derived from the shapes of the parts in `src/core/state/` and no longer
  written by hand; `logic/types.ts` re-exports the names the views use.


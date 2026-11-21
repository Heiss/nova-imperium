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
  `field-drafts.ts`, `news.ts`, `routing.ts`, `view-address.ts`, `dispatch.ts`
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
  `data-nokeep`. The field drafts below ship with the update; the state of
  each form in its own component follows after it (#332). **[V]** Every other field of a view with an id has a draft
  (`logic/field-drafts.ts`, `field-drafts.ts`): the change of a field is
  recorded when it happens (input and change), a button or feature that fills
  a field writes it through `writeField` (also `setInput`, `setById`), and a
  view that is drawn anew gets the drafts back (`restoreFields` in `render.ts`;
  not onto a disabled option, ticks of the rank boxes, not a disabled box). The
  drafts are dropped where the typed fields were dropped before: a fresh render
  and a logout. Fields without a draft show the state of the server: the
  settings of the universe (`logic/settings-draft.ts` keeps their draft), the
  link of the invitation and the confirmation of a dissolving (a modal outside
  `#view`); chat and buddy name have their own drafts. The position of the
  Sternenkarte (`g_g`, `g_s`) has a draft, kept until Enter, an arrow or
  „zum Heimatsystem“ draws the page anew (a fresh render drops it).
  **[E]** Owner, 2026-11-20: no client code sets the value, tick or chosen
  option of a field except through `writeField` (or `setInput`/`setById`,
  which use it): a write that goes round it is not recorded, and the next poll
  redraw puts the older draft back over it. The guard
  `src/test/field-writes.test.ts` reads the syntax trees of `src/client`
  (TypeScript and Svelte, tests excluded) and fails on `.value =`, `.checked =`,
  `.selectedIndex =`, `.selected =` (also `+=`, `++`, `["value"] =`) and
  `setAttribute('value', …)`. Allow-list: `field-drafts.ts` (it implements
  `writeField` and `restoreFields`). A Svelte `bind:` or `value={…}` is no
  write. The scan found one bypass, the settings of the universe put back by
  `features/admin.ts`, now written with `setById`.
  `normalize()` of `src/test/markup.ts` ignores `data-nokeep`, so the frozen
  HTML of the reference tests stays as it was. E2E: `e2e/redraw-drafts.spec.ts`.
* **[E]** Owner, 2026-11-20: `acts()` and `forms()` are free of side effects.
  A feature registers its page listeners (change, input, keydown, submit,
  window events) in the optional hook `listen(ctx)`, which the assembly calls
  once at start (`startListeners` in `assemble.ts`, called by `dispatch.ts`).
  `registry.test.ts` checks that every feature contributes something (acts,
  forms, `afterRender` or `listen`) and that building `acts` and `forms` adds no
  listener to the document or the window.
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


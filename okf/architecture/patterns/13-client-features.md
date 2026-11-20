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
  `keep-inputs.ts`, `news.ts`, `routing.ts`, `view-address.ts`, `dispatch.ts`
  (the click and submit dispatch with the context of the features),
  `clock.ts`, `boot.ts` and `ui-init.ts`. The frame handlers (sheet „Mehr“,
  dialog, planet choice, logout), the share of a producer, the animations,
  the activity sample and the marks „gelesen“ are the features `frame`,
  `producers`, `options`, `session-activity` and `reading`; a feature that
  only listens to the page returns no handlers (`registry.test.ts`).
  `ClientCtx` got `quiet` and `apply(state, fresh)`.
* **[V]** Forms own their input: „Account löschen“ is a component
  (`views/DeleteAccountDialog.svelte`) with its own password and busy state;
  the message of the guild chat and the name of a new buddy show a draft of
  `logic/drafts.svelte.ts`, which a redraw of the page does not touch (both
  fields are `data-nokeep`, so `keepInputs` no longer restores them); a fresh
  render drops the drafts, as it dropped the typed fields before. The
  dialogs „Leitung übergeben“ and „Gilde auflösen“ stand in the modal, which
  a redraw does not replace, and still read their fields by id. The other
  fields of the views that are mounted anew on every render (fleet, market,
  options, the guild forms, the profile of a guild and others) still depend
  on `keepInputs` (`keep-inputs.ts`).

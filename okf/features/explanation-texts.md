---
type: feature
title: Explanation texts
description: Long explanation texts for catalog entries with a display option per player (issue #63); the texts themselves come with the grimdark naming (#94).
---

# Explanation texts

Issue #63, milestone `next release` (owner, 2026-11-12). The content rules of
the issue are decided there ([E]): lore, what it does, what a further level or
more units change; costs, time and energy stay visible separately; statements
must match the code.

* **[E]** Display option „Immer anzeigen“ / „(?)-Symbol“ / „Ausblenden“ is
  stored on the server per player, a new column like `probes`, with a
  migration (D1 = 1, owner, 2026-11-12).
* **[E]** Default for new players: „(?)-Symbol“ (D2 = 2, owner, 2026-11-12).
* **[E]** The (?) opens an inline panel below the entry on click or tap; the
  same for touch, keyboard and screen readers (D3 = 1, owner, 2026-11-12).
* **[E]** Order: #63 builds the mechanism (option, (?), panel) with the
  current `ds` as placeholder. The long texts are drafted by Claude as [V] in
  the grimdark style in the rename pull request (#94; its concept
  „Grimdark naming“ is not on `main` yet); the owner confirms them there
  (D4, owner, 2026-11-12).
* **[E]** The short `ds` stays as a one-line summary that is always visible,
  also with „Ausblenden“; the long text is separate (D5 = 1, owner,
  2026-11-12).
* **[V]** The option sits in „Hilfe & Optionen“ (`src/client/views/misc.ts`)
  next to „Sonden pro Spionage“.

# Code, interface and tests

* Option: column `users.explain_mode` (`always`, `icon`, `hidden`, default
  `icon`, CHECK), added by migration 10 (see [SQLite storage](/data/sqlite.md));
  existing players get the default. The modes and the fallback to `ds` live in
  `src/shared/explain.ts`. The action `options` takes `explain` next to
  `probes` and refuses another value („Ungültig.“).
* **[V]** Without `explain` (an older client) the action keeps the stored
  mode.
* Catalog: optional field `lt` (long text) for buildings, research, ships and
  defense. The panel shows `lt`, else `ds` (D4); an entry without either has
  neither (?) nor panel. Since the branch of #94 every entry on `main` has
  an `lt` ([E], grimdark style, confirmed by the owner 2026-11-12, see
  [Grimdark naming](/features/naming.md)), so the ships and the defense
  get the (?) too; the entries of #50 and #60 got theirs with the rename
  ([V]).
* Interface: `src/client/logic/explain.ts` decides per entry and mode;
  `itemHTML` (research, shipyard, defense) and `Buildings.svelte` render it.
  The buildings view now shows the short `ds` too (D5). The (?) is a
  `<button>` with `aria-expanded`, `aria-controls` and the name „Erklärung zu
  ‹Name›“; Enter and Space work as on every button. Opened panels are kept
  while the page is open (not stored).
* **[V]** Labels: „Erklärungstexte:“ with „Immer anzeigen“, „Als (?)-Symbol“,
  „Ausblenden“ (the drafts of the issue), in the box „Optionen“, saved with
  its button „Speichern“.
* **[V]** Design after the mockup `docs/design/explanations/` (`button.exq`,
  `.ex` in `src/client/static/style.css`); the (?) is 24 px instead of 20 px,
  the minimum target size of WCAG 2.2. The text is plain text, escaped, in
  one paragraph; the structure of the texts of #94 (lore, what it does, per
  level) may need more.
* Tests: `src/shared/explain.test.ts` (also every catalog entry has an
  `lt` but the list `LATER`, and no classic name in it),
  `src/client/logic/explain.test.ts`,
  `src/server/db/upgrades/migration-10.test.ts`, the option in
  `actions.test.ts`, `store.test.ts` and `auth.test.ts`; E2E in
  `e2e/game.spec.ts` („explanation texts (#63)“: click, keyboard, tap on a
  phone, all three modes after a reload) and `e2e/a11y.spec.ts` (closed,
  opened and always shown). The E2E test checks that the panel shows `lt`
  (Adamant-Tiefbohrung, Auspex-Lehre, Spähschädel, Sonnenkathedrale); an entry
  without any text is left to the unit tests, as no catalog entry on
  `main` is one.

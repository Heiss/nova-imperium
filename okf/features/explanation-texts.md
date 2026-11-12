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
  the grimdark style in the rename pull request (#94, see
  [Grimdark naming](/features/naming.md)); the owner confirms them there
  (D4, owner, 2026-11-12).
* **[E]** The short `ds` stays as a one-line summary that is always visible,
  also with „Ausblenden“; the long text is separate (D5 = 1, owner,
  2026-11-12).
* **[V]** The option sits in „Hilfe & Optionen“ (`src/client/views/misc.ts`)
  next to „Sonden pro Spionage“.

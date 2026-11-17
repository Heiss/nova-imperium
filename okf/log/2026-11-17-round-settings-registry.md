---
type: log-entry
date: 2026-11-17T12:00
kind: Code
issues: [283, 221, 191, 214, 242, 222, 224, 223, 228, 229, 202, 55]
---

#283, the settings of a round as a registry, without a visible change: `ROUND_SETTINGS` in `src/core/round.ts` holds the reward options, the guild switch and the lock of the main planet of #221, each with its key, German label, range or choices, default and refusal; #191 and the reward options of #214 keep their texts. `roundRules()`, the reset action, the dialog „Neue Runde“, the request of the client (`src/client/round-actions.ts`, out of `src/client/main.ts` for the ratchet of #242) and the universe settings read it; an entry with `live` is also a row of the universe settings. The features of #222 (#224, #223, #228, #229, #202, #55) now add one entry in their own file and one line to the sorted list. Tests compare the dialog and the reset action with their earlier output and show that a new entry appears in both places, is checked, starts with its default and is kept when not sent.

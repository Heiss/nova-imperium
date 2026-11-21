---
type: log-entry
date: 2026-11-21T09:10
kind: Code
issues: [332, 118, 163]
---

#332, a follow-up of package 8 of #118: forms keep their fields as the state of their component instead of the uniform field drafts. A form's state is a module of its own, as a view that is mounted anew loses what its component held (`logic/form-state.svelte.ts`, dropped by a fresh render and a logout); the component shows it and the handlers read and write it. Converted: the filter of the achievements and the position of the Sternenkarte (before this entry), the marketplace, the fleet form for the ships, the target position, the speed, the cargo and the names to invite into a union, „Optionen“ (choices, passwords, the text of „Problem melden“), „Gilden“ (profile, rank names, a new rank, the rank of a member, the rights, a disabled box showing the server as in #163) and „Admin“ (invitation, message to all players; the filters already kept their own state). A number field takes `value` with `oninput`, not `bind:value`: checked against Svelte's `bind_value`, a binding stores a number or null and, with a getter that has a fallback, writes the fallback over a half-typed value. One visible fix: after a sent report the poll redraw no longer puts the sent text back into „Problem melden“. It stays, with a changelog fragment ([V], coordinator 2026-11-21).

The inventory of the fields that still depend on the drafts is in `okf/architecture/patterns/13-client-features.md` („Per-form component state“): the target kind, mission, union, holding time, Schnellwahl and Warp-Tor of the fleet form, and the amounts of the four lists. `field-drafts.ts`, `logic/field-drafts.ts` and `restoreFields` stay until they are converted; the drafts keep values only now (the rank boxes were the last ticks).

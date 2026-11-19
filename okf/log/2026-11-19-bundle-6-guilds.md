---
type: log-entry
date: 2026-11-19T23:59
kind: Code
issues: [118, 163, 277, 169, 274, 242]
---

#118, bundle 6 (the order of the bundles of „Geklärt, Nachtrag 3“, unchanged by „Nachtrag 4“): „Gilden“ is a Svelte component. `Guilds.svelte` renders `guildsPage()` of the new `logic/guilds.ts` (the directory, the page of a guild with its members and ranks of #163 and #277, the chat of #169 and the management of the own guild); the hand-over, dissolving and the admin's chat are components too (`GuildDialogs.svelte`), shown by `modal()`, which moved from `main.ts` to `src/client/modal.ts` and takes HTML or a component [V]. The view is mounted anew on every render, registered in `views/mount.ts` and removed from `VIEWS`. The markup, ids and `data-*` hooks are those of the HTML view, so the handlers of `features/guilds.ts` and `features/social.ts`, `keepInputs`, `keepChatScroll` and the phone rules of #274 keep working. A property test keeps the components equal to the frozen HTML (300 states, seed 118, plus the dialogs) with hand-built cases; `normalize()` of `src/test/markup.ts` now also reads `required` and `checked` and ignores white space next to `form` and `h3`. `main.ts` 1,191 to 1,186 lines (the limit of #242 lowered). No visible change (the label `kein-changelog`, no fragment); see [Design patterns](/architecture/patterns.md), [Test strategy](/ops/testing.md).

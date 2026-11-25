---
type: log-entry
date: 2026-11-24T17:00
kind: Code
issues: [373, 351, 191]
---

Whether a client view is offered is one rule on the view (#373, part of the foundation of v3, #351; a refactor without a change of behaviour). `ClientView.offered(round, admin)` replaces `MenuItem.show` and the names admin, achievements and guilds kept by hand in `hiddenView()` (#191); the menu, the tabs of a phone, the address and the fallback of `mountView()` all ask `offered()` of `src/client/views/offered.ts`. Tests: `src/client/views/registry.test.ts` (every view and round: menu, tabs and address follow the rule; a rule defined twice stops the start; the navigation, the address, the mount and `index.ts` name no such view). Existing tests unchanged, except that the list of the known members of a view in `registry.test.ts` gains `offered`.

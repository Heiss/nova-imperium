---
type: log-entry
date: 2026-11-24T18:00
kind: Code
issues: [379, 351, 160, 163, 285]
---

A client view declares its own address parameters (#379, part of the foundation of v3, #351, for the deep links of the star map, #160; a refactor without a change of behaviour). `ClientView.address` lists them; `viewUrl` keeps those of the open view and drops all others, `addressParams` reads them, and `client.ui.params` replaces `ui.guild` (coordinator, option 1, [V]). „Gilden“ declares `guild` (#163), the Lexicanum `a` (#285). Tests: `src/client/logic/address-today.test.ts` (every address of today, dropped cases too; the same table passed against the code before with its old `viewUrl`), the guard in `src/client/views/registry.test.ts`. Changed existing tests: the Ui fixtures `guild: 'x'` → `params: { guild: 'x' }` in `src/client/views/guilds.test.ts`, `src/client/logic/guilds.test.ts`, `src/test/guilds-reference.test.ts` (also its frozen renderer's read of the guild) and `guild: null` → `params: {}` in `src/client/logic/state.test.ts`; the calls of `viewUrl` in `src/client/logic/address.test.ts` take the parameters and the table (same expected addresses); the known members in `registry.test.ts` gain `address`.

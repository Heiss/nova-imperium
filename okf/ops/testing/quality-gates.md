---
type: Policy
title: 'Quality gates'
description: 'Mutation standard per file, coverage, ESLint complexity, the ReDoS lint and code hygiene that block in the CI.'
---

# Quality gates

* **[E]** Mutation standard per file (owner, 2026-11-11,
  `mutation-standard.json`, `mutation-floors.txt`,
  `scripts/mutation-gate.ts`): no file may fall below its recorded floor; a
  new file needs 80 %, a new security file 90 %. Security files
  (authentication, sessions, passkeys, admin rights, moderation, account
  deletion, audit, request limits) aim for 90 %. The floors are raised from
  the merged report of a complete CI run with
  `node scripts/mutation-floors.ts` (owner, 2026-11-19, #304; before, the
  pull request that added tests raised them with
  `mutation-gate.ts --update` from a local run). Floors never go down,
  except to the cap below.

* **[E]** The cap of the floors (owner, 2026-11-21, #338): a floor demands
  at most 95 % (`cap` in `mutation-standard.json`); a file below it keeps its
  ratchet up to the cap, above it nothing is demanded („too perfectionist“:
  one surviving mutant no test can kill no longer fails a file at 100 %).
  The sensitive files keep their exact floor (`exact`, confirmed by the owner
  on 2026-11-21): the journal (`src/server/game/journal-input.ts`,
  `journal.ts`), accounts and sessions (`src/server/auth.ts`,
  `account-security.ts`, `passkeys.ts`, `delete-account.ts`, `claim.ts`,
  `src/client/logic/auth.ts`, `login.ts`), limits and the HTTP boundary
  (`src/server/http/security.ts`, `action-limit.ts`, `rate-limit.ts`,
  `app.ts`, `request.ts`, `admin.ts`), audit and moderation
  (`src/server/audit.ts`, `src/server/game/moderation.ts`,
  `src/server/game/admin.ts`) and, with #226, the module of the private
  messages and of „Melden“ (`src/server/game/private-messages.ts` [V]). The
  rule „never lower a floor“ stays for a floor up to the cap and for every
  floor of the list. **[V]** `scripts/mutation-gate.ts` demands the lower of
  the recorded floor and the cap of a file outside the list (it says
  „capped“), so it holds before the floors file is rewritten;
  `scripts/mutation-floors.ts` writes no floor above the cap for such a file
  and lowers one above it to the cap („capped“ in its summary). The
  coordinator rewrites `mutation-floors.txt` once from the report of a
  complete run with that script, never by hand. A standard without `cap`
  reads as no cap (100) and no list: the stricter reading. **[E]** (owner,
  2026-11-21, the three open points of #338): the building agent may mark a
  mutant that no test can kill with
  `// Stryker disable next-line <Mutator>: <reason>`, only in a file of the
  list, each mark with a reason that says why no test can tell the mutation,
  and every mark is listed in the report of the pull request
  (`node scripts/mutation-marks.ts` prints them); the guard test
  `src/test/mutation-marks.test.ts` checks every file Stryker mutates and
  fails on a mark outside the list, in another form (a whole file, `all`,
  `restore`) or without a reason ([V]: a reason of fewer than 10 characters
  counts as none). A new file still needs 80 % (a new security file 90 %).
  A drop above the cap is a notice of the run, no failure:
  `scripts/mutation-gate.ts` prints `::notice` per file whose score fell
  below its recorded floor and stays at or above the cap.

* **[E]** Coverage blocks below 90 % of the lines and 85 % of the branches.

* **[E]** ESLint blocks: cyclomatic complexity ≤ 10, cognitive complexity
  (sonarjs) ≤ 10, nesting ≤ 4, functions ≤ 50 lines (tests are free of the
  length rule). The dense code of version 1 was rebuilt into small functions;
  no place is exempted.

* **[E]** ReDoS lint (owner, 2026-11-25, 80a/81a, #367): the rule
  `redos/no-vulnerable` of `eslint-plugin-redos` (recheck, MIT, pinned
  exactly) runs over every file `eslint .` covers and blocks in its own CI
  job „ReDoS lint“, which runs for every change and which the CI Gate
  requires like „Workflow lint“. In production code and `scripts/` a
  polynomial or exponential expression is a finding; in tests
  (`**/*.test.ts`, `e2e/**`, `src/test/**`) only an exponential one. A
  timeout of the check is a finding too. A finding is fixed by rewriting
  the expression, with a test that it behaves as before and a hostile
  input that is now fast; a disable comment only for a proven false
  positive. The ten findings of 2026-11-25 were rewritten so (#367).
  **[V]** How it is built: `eslint.redos.config.js` enables only this rule,
  with the TypeScript parser and the ignores of `eslint.config.js`, so
  `pnpm lint` keeps its speed; `pnpm lint:redos` runs it with the ESLint
  cache (`--cache-strategy content`, in
  `node_modules/.cache/eslint-redos/`), which the CI job keeps with
  `actions/cache` per lockfile and ESLint configuration. The timeout per
  expression is 30 s (`timeout`, `ignoreErrors: false`): the slowest check
  of the tree of 2026-11-25 took 3.2 to 3.6 s (850 checks, about 100 s in
  all, measured locally on 4 cores with recheck's native binary), so the
  timeout leaves about eight times that. The tests of a rewritten
  expression compare it with the old one on many generated texts
  (`src/test/redos.ts`) and bound a hostile text of 50,000 characters to
  100 ms, which the old ones took 0.8 to 5 s for.

* **[E]** Code hygiene blocks in the job „Lint, types, unit tests …“
  (owner, 2026-11-11): knip (`knip.json`: no unused files, exports or
  dependencies), jscpd (`.jscpd.json`: no copied block of 50 tokens or more
  in production code; tests, E2E and version 1 are excluded) and
  dependency-cruiser (`.dependency-cruiser.cjs`: `src/core` imports neither
  server nor client, the client never the server and the reverse, production
  code no test helpers, server, core and feature code no dev dependencies,
  no circular imports at runtime; the boundaries of the feature folders,
  see [Design patterns](/architecture/patterns.md), section 11, tested by
  `src/test/boundaries.test.ts` on a small project per rule).

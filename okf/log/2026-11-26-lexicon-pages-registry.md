---
type: log-entry
date: 2026-11-26T23:59
kind: Code
issues: [426, 395, 424]
---

#426 part 1 built with the owner's decisions of 2026-11-26 (192a, 193b): the pages of the Lexicanum register themselves like the option boxes of #395. Each file of `src/core/lexicon/pages/` ends with `export const lexiconPage = { order, page }`; `scripts/gen-features.ts` writes `pages/pages.gen.ts`, and `pages/index.ts` names no page any more. It sorts the pages by `order` and stops the start at an order or an address defined twice. The orders keep the start page as it was, in steps of ten (checked against the list before the change: the same 37 addresses in the same order). No text and no behaviour changed; `highscore.ts`, which #424 changes, got only the registration line and lost the `export` of its `page`.

---
type: log-entry
date: 2026-11-28T10:36
kind: Docs
issues: [479, 480, 481, 482, 483, 484]
---

An audit of the server, the client, the tests and the image, asked for by the owner on 2026-11-28, and an evaluation of Rust (with rust-anything), WebAssembly and Bun before it. The evaluation recommends none of the three [V]: the measured costs are algorithmic, the decisions TypeScript and better-sqlite3 stand, and v3 is not a fresh start ([Stack evaluation](/architecture/stack-evaluation.md)). The audit measured, among others, `stateFor` at 38.4 ms with 1,830 statement compilations and 11.7 ms with a statement cache, every static file downloaded in full on every load, no timeout for a request, a partial mutation run of 44 minutes in one job and a new layer of 43 MB of `node_modules` in every release ([Performance audit](/architecture/performance-audit.md)). The findings are in issues by component, each but the first with open decisions of the owner: #479 the daily reward (decided by the owner the same day: the median fixed at 23:05 UTC, where the day of the reward then changes, without the weakest 10 % by total points, rounded half up, a round setting), #480 the speed of the server, #481 its structure, #482 the client on mobile connections, #483 the CI and the tests, #484 the image, with the owner's question on Alpine and distroless. Nothing was built.

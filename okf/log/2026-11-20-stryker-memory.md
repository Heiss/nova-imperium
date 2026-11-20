---
type: log-entry
date: 2026-11-20T13:00
kind: Code
issues: [304]
---

Measured why the complete mutation run (run 44676176157) lost 3 of 12 hosted runners (#304). On a 4-core, 16 GB machine a local Stryker run (`concurrency: 4`, eight large server files, 34 minutes) let every worker process grow from about 1.2 GB to 3.7 GB, in steps and never levelling off, while the JavaScript heap of the process stayed near 100 MB: the memory is native. All four workers together reached 13.3 GB with 2.8 GB left free; the runners have the same 16 GB. `memoryDatabase()` in `src/server/test-helpers.ts` made an in-memory database of about 0.5 MB per test context and never closed it. It now closes it when its test ends (`onTestFinished`; a database made outside a test lives on), and `caseDatabase()` opens a new one when an earlier test closed its database. Same run after the change: workers at most 2.7 GB, all together 9.5 GB, 6.6 GB free, same mutation score (93.62). No test, assertion, case or timeout changed. The memory still grows slowly, so the cause is not fully removed. [U]

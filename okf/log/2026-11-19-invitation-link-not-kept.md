---
type: log-entry
date: 2026-11-19T18:10
kind: Code
issues: [239]
---

The field with the link of the last invitation is no longer kept over a refresh of the page (#239): a refresh that keeps the inputs put the value of the field before back, so the link of the invitation before could show after the next one. The bug was never reproduced; the owner chose the precaution (2026-11-19).

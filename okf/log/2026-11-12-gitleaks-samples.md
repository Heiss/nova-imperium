---
type: log-entry
date: 2026-11-12
kind: Decision
issues: [126]
---

A gitleaks finding that is only a sample value in a test goes into `.gitleaksignore` with its fingerprint when it stays in the history; the test now makes its token at run time (#126; see [Test strategy](/ops/testing.md)).

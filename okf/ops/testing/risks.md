---
type: Policy
title: 'Risks'
description: 'What is unverified about the CI workflows and the cost of the mutation tests.'
---

# Risks

* **[U]** The CI workflows were written after muffelblog and checked locally
  step by step (lint, types, tests, coverage, Stryker, Playwright, image
  build, Compose stack with smoke test, gitleaks); the first run on GitHub is
  the proof.

* Mutation tests take minutes; the incremental run keeps pull requests and
  pushes to `main` fast. Stryker's incremental mode only notices changes in
  mutated files and tests, not in helpers or configuration; the complete
  nightly run catches what it misses.

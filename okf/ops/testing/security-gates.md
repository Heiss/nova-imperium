---
type: Policy
title: 'Security gates'
description: 'gitleaks, pnpm audit and the other security gates, and what to do with a finding that is no secret.'
---

# Security gates

* **[E]** A gitleaks finding that is no secret (a sample value in a test)
  is removed from the code; when it stays in the history, its fingerprint
  goes into `.gitleaksignore` (`commit:file:rule:line`), named in the pull
  request. First case: the sample token of `src/server/error-log.test.ts`
  in commit f45319c (#126, owner, 2026-11-12).

* **[E]** Security gates: gitleaks over the whole history, `pnpm audit --prod`
  (high blocks), CodeQL `security-extended` (severity ≥ 7.0 and every result of level
  „error“ block, `.github/scripts/codeql-gate.mjs`), Trivy on
  the image (holes with a fix: in a release pull request, a pull request into
  and a push to `hotfix/**` high and critical block; other pull requests
  block on the critical holes they bring in, compared with the image of the
  base branch; a push to `main` blocks on every critical hole; owner
  2026-11-12). CodeQL runs for every pull
  request, documentation included, because the ruleset of `main` requires a
  CodeQL result for the exact commit (owner, 2026-11-11).

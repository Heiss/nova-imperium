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

* **[E]** gitleaks in CI (owner, 2026-11-25, 143a): a pull request scans
  only its own commits (`--log-opts` with the base and head commit of the
  event, passed as environment, never written into the script), so a branch
  of someone else among the fetched refs fails no other pull request; a push
  to `main` or `hotfix/**` and the nightly run scan the whole history of all
  refs. Cause: a test password on an unmerged branch made every pull
  request fail (2026-11-25). Before each push a branch is scanned locally
  with gitleaks 8.30.1 on `origin/main..HEAD`.

* **[E]** The log of the gitleaks step (owner, 2026-11-26, 153a): no
  `--verbose`; gitleaks writes its report as JSON (`--report-format json
  --report-path`, `--redact` kept) into a directory under `$RUNNER_TEMP`
  mounted into the container. After the run, jq on the runner prints each
  finding by its RuleID, File, StartLine and Commit only (as JSON strings,
  so a file name cannot start a workflow command), never Match, Secret or
  the line. The step fails with the exit code of gitleaks, on a finding,
  and when the report is missing or unreadable. The report is not uploaded
  and is deleted at the end of the step. Test: `src/test/ci-release.test.ts`
  (a fake docker).

* **[E]** Security gates: gitleaks over the whole history, `pnpm audit --prod`
  (high blocks), CodeQL `security-extended` (severity ≥ 7.0 and every result of level
  „error“ block, `.github/scripts/codeql-gate.mjs`), Trivy on
  the image (holes with a fix: in a pull request into
  and a push to `hotfix/**` high and critical block, in a release pull
  request too until #387, which builds no image since then; other pull requests
  block on the critical holes they bring in, compared with the image of the
  base branch; a push to `main` blocks on every critical hole; owner
  2026-11-12). CodeQL runs for every pull
  request, documentation included, because the ruleset of `main` requires a
  CodeQL result for the exact commit (owner, 2026-11-11).

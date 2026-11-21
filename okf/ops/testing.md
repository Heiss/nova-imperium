---
type: Policy
title: Test strategy
description: Kinds of tests, quality gates and the role of the CI Gate before a pull request goes to review.
tags: [tests, tdd, e2e, mutation, ci, vitest, playwright, stryker]
status: draft
generated: { by: claude-code/web, at: 2026-11-06T21:00:00Z }
---

# Test strategy

The test strategy is split by topic into the notes below.

## Tests

* [Rules and CI runs](/ops/testing/unit-and-ci.md) - The rules of muffelblog this project follows, which pushes run the full suite, unit tests first, and the property tests of the migrations.
* [Kinds of tests in this project](/ops/testing/kinds-of-tests.md) - The kinds of tests in a table: where each lives and what it proves.
* [E2E tests](/ops/testing/e2e.md) - Playwright E2E tests: the acceptance criteria of a pull request, seeding, mails, accessibility, one spec per feature and tests that own their data.
* [E2E inventory](/ops/testing/e2e-inventory.md) - The E2E tests of #68 and what they cover.
* [Tests of components](/ops/testing/component-tests.md) - The contract tests per component, the rows of the resources page, and Svelte components and state modules in Vitest.
* [Reference tests of the Svelte views](/ops/testing/svelte-view-tests.md) - The property and reference tests of the views converted in #118, list by list and bundle by bundle.
* [No catalog key outside src/features](/ops/testing/catalog-key-scan.md) - The test that finds a comparison with a catalog key outside src/features and what it scans.
* [Tests of missions](/ops/testing/mission-tests.md) - Contract tests of the missions as strategies (#116).

## Mutation tests

* [Mutation tests and shards](/ops/testing/mutation-tests.md) - Stryker mutation tests, the score that blocks, static mutants, the sharded runs, stable shards and their weights.
* [Mutation runs of a pull request](/ops/testing/mutation-partial.md) - A pull request mutates only what it changes: when the jobs start, the partial run, its floors and limit, and the nightly issue.
* [Test files and the takeover of a mutation run](/ops/testing/mutation-takeover.md) - Which files start the mutation jobs, and when a pull request takes over the green run of the head before.
* [Proofs of a push run](/ops/testing/push-proofs.md) - When a push to main or a hotfix branch skips a job that succeeded on the identical tree, and how the CI Gate checks the proof.
* [Display texts are not mutation-tested](/ops/testing/mutation-texts.md) - Why the display texts are left out of the mutation tests and how they are tested instead.
* [Code of the sharded mutation runs](/ops/testing/mutation-code.md) - The scripts and jobs of the sharded mutation runs (#131): plan, gate, caches, tolerance and the previous plan.
* [Code of the changed-file and reuse runs](/ops/testing/mutation-changes-code.md) - The scripts that choose what a pull request mutates and reuse a green run, with the measured proof runs and the text module.

## Gates

* [Quality gates](/ops/testing/quality-gates.md) - Mutation standard per file, coverage, ESLint complexity and code hygiene that block in the CI.
* [Workflow lint](/ops/testing/workflow-lint.md) - The job that checks the workflows and the tests of the shell of the release detection.
* [Security gates](/ops/testing/security-gates.md) - gitleaks, pnpm audit and the other security gates, and what to do with a finding that is no secret.
* [Append-only migrations and the size ratchet](/ops/testing/migrations-and-ratchet.md) - The job that keeps migrations append-only and the ratchet that keeps src/client/main.ts from growing.
* [Scope of coverage and mutation, level at the introduction](/ops/testing/scope-and-level.md) - Which folders coverage and mutation measure and the test level at the introduction of the strategy.

## Risks

* [Risks](/ops/testing/risks.md) - What is unverified about the CI workflows and the cost of the mutation tests.

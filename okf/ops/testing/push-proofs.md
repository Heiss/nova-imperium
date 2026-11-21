---
type: Policy
title: 'Proofs of a push run'
description: 'When a push to main or a hotfix branch skips a job that succeeded on the identical tree, and how the CI Gate checks the proof.'
---

# Proofs of a push run

* **[E]** Owner, 2026-11-21, #342 ([Branches and releases](/ops/branching-release.md)):
  a push run does not repeat what already ran green on identical content.
* **[V]** The decision is the pure function `decide` of
  `scripts/already-tested.ts` over the answers of the REST API; the step
  `proof` of the job „Detect changes“ in `.github/workflows/ci.yml` only
  calls it on a push (`decide <sha> <branch>`) and writes its five lines
  `proof-check`, `proof-e2e`, `proof-mutation`, `proof-compose`,
  `proof-site` to the outputs. A job is proven when:
  * the pushed commit is the merge commit of exactly one merged pull request
    of this repository into the pushed branch (`GET
    /repos/{repo}/commits/{sha}/pulls`);
  * a run of `.github/workflows/ci.yml` of that pull request's head commit,
    event `pull_request`, of this repository and not of a fork, completed
    with success, so its CI Gate was green (`GET
    /repos/{repo}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=…`);
  * the commit that run names (`head_sha`) has the Git tree of the pushed
    commit (`GET /repos/{repo}/git/commits/{sha}`): trees, never commit ids;
  * the job of that run, latest attempt, completed with success (`GET
    /repos/{repo}/actions/runs/{id}/jobs?filter=latest`); the newest such run
    gives the proof.
  The jobs and their names: „Lint, types, unit tests with coverage, build“,
  „E2E tests (browser)“, „Mutation tests“ (the gate of the complete run: it
  is skipped in a partial or taken-over run, so those prove nothing, O23),
  „Docker image and Compose stack“, „Documentation website“. The cheap jobs
  (secrets and dependencies, migrations, workflow lint, CodeQL, the change
  detection) run on every push.
* **[V]** It fails closed: no pull request (a direct push), two of them, one
  not merged or into another branch, no green run, a run of a fork or of
  another workflow, a red, cancelled or running run, the cheap run of the
  draft release pull request (its gate fails on purpose, #147), a different
  tree, an answer of another shape and every error of the API prove nothing,
  and so does a failure of the step itself (it writes no proof then, and only
  the five proof lines reach the outputs). Each job is proven on its own.
* **[V]** The job „Detect changes“ gets `actions: read` and
  `pull-requests: read` besides `contents: read` and `checks: read`. On a
  push it checks out its own commit, the folder `scripts/` only, and runs the
  script with Node; nothing of a pull request is checked out or run.
* **[V]** Each expensive job runs when its detection says so and its proof
  is empty. The CI Gate (`require_success_or_proof`): without a proof the
  job must succeed; with one, the event must be a push and the job must be
  skipped, and the gate prints „<job>: skipped, it succeeded on the identical
  tree: CI run <id>, job "<name>" (<url>), head <sha>, tree <tree>“. The
  mutation plan, the shards and „Mutation tests“ share the proof of
  „Mutation tests“. Every other case of the gate is unchanged.
* **[V]** A proven push runs no mutation job, so it does not refresh the
  caches of `main` (the state, the incremental results of the shards, the
  weights); the nightly run of `.github/workflows/mutation.yml` on `main`
  refreshes them, and a pull request falls back to them as before. They only
  speed a run up: Stryker checks every cached result against the files.
* **[V]** Tests: `src/test/already-tested.test.ts` over recorded answers
  (the full green run, the partial mutation run, a failed or missing job,
  the newest run per job, a different tree, no pull request, two of them,
  the wrong branch or repository, a fork, another workflow or event, a red,
  cancelled or running run, the cheap draft run, API errors and answers of
  another shape, the command). The workflow cannot run before a push: the
  cases of the gate were run locally from the script of the gate, and
  actionlint with shellcheck and zizmor pass. The first live use is the push
  after the merge of the collecting pull request of 26.11.24; watch it before
  the release pull request is merged.

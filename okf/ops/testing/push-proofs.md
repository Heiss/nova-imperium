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
  „E2E tests (browser)“, the mutation jobs („Mutation tests“, the gate of the
  complete run, or „Mutation tests (changed files)“, the partial run of
  #309: either proves the plan, the shards and „Mutation tests“ of the push;
  owner, 2026-11-21, O23; **[V]** a run whose „Detect changes“ found nothing
  to mutate proves them too, coordinator, 2026-11-21: that job notes its
  result as the annotation „Mutation jobs“, and the note `false` is read
  through `GET /repos/{repo}/check-runs/{job}/annotations`; a run that took
  over the result of its head before, #167, note `reuse`, was tested on
  another tree and proves none, nor does a run without the note),
  „Docker image and Compose stack“, „Documentation website“. The cheap jobs
  (secrets and dependencies, migrations, workflow lint, ReDoS lint since
  #367, CodeQL, the change detection) run on every push.
* **[V]** It fails closed: no pull request (a direct push), two of them, one
  not merged or into another branch, no green run, a run of a fork or of
  another workflow, a red, cancelled or running run, a different tree, an answer of another shape and every error of the API prove nothing,
  and so does a failure of the step itself (it writes no proof then, and only
  the five proof lines reach the outputs). Each job is proven on its own.
  The mutation jobs of a push to `main` are the exception since #370: they
  do not run without a proof either (200a, below).
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
* **[E]** A push to `main` runs no mutation job (owner, 2026-11-26, #370,
  195a and 200a): „Detect changes“ writes `mutation=nightly`, the proof of
  the pull request is still looked up and printed by the CI Gate, and
  without one the gate passes and says that the nightly complete run
  (`mutation.yml`) tests `main` as it is that night, not necessarily the
  tree of that push. A push to `hotfix/**` keeps the rule
  below.
* **[V]** A proven push runs no mutation job, so it does not refresh the
  caches of `main` (the state, the incremental results of the shards, the
  weights); the nightly run of `.github/workflows/mutation.yml` on `main`
  refreshes them, and a pull request falls back to them as before. They only
  speed a run up: Stryker checks every cached result against the files.
* **[V]** Tests: `src/test/already-tested.test.ts` over recorded answers
  (the full green run, the partial mutation run, a failed or missing job,
  the newest run per job, a different tree, no pull request, two of them,
  the wrong branch or repository, a fork, another workflow or event, a red,
  cancelled or running run, API errors and answers of
  another shape, the command). The workflow cannot run before a push: the
  cases of the gate were run locally from the script of the gate, and
  actionlint with shellcheck and zizmor pass. The first live use is the push
  after the merge of the collecting pull request of 26.11.24; watch it before
  the release pull request is merged (since #387 the release pull request
  runs no expensive job and relies on that push run).

* **[E]** The push of a release merge takes over the results of the commit
  before it (#387, owner, 2026-11-24, 77a): when the pushed commit changes
  only `VERSION`, `CHANGELOG.md` and `changes/` against its first parent
  (the `compare` API, at most 300 files), every job without a proof of the
  pull request takes the proof of the newest green push run of that parent
  on the branch: the job succeeded there, or that run skipped it with its
  own proof (a green push run skips a job only so). An error of that lookup
  keeps the proofs of the pull request and proves nothing more. Tests in
  `src/test/already-tested.test.ts`; `src/test/release-metadata.test.ts`
  lists every file that names a metadata file.

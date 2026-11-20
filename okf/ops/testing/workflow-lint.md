---
type: Policy
title: 'Workflow lint'
description: 'The job that checks the workflows and the tests of the shell of the release detection.'
---

# Workflow lint

* **[E]** The workflows are checked by the job „Workflow lint“ for every
  change (owner, 2026-11-11): actionlint (syntax, expressions, shell) and
  zizmor (security). Every action is pinned to a commit hash with the version
  as a comment; Renovate updates both (`helpers:pinGitHubActionDigests`).
  **[V]** The comment names the exact release (`# v7.0.1`), never a moving
  major tag (`# v7`): when upstream moved such a tag, zizmor reported that
  hash and comment no longer match and „Workflow lint“ failed on every pull
  request (2026-11-18, `actions/create-github-app-token`, set to `# v3.3.0`
  by #299; #303). The owner has not chosen among the options of #303; this
  is option 1 and follows #299. **[U]** That Renovate writes the exact
  version into the comment when it updates such a pin (otherwise the
  preset `helpers:pinGitHubActionDigestsToSemver` is the option 2) is not
  verified.
  Checkouts keep no credentials, except where a job pushes with the release
  App's token: `tag.yml` (`scripts/release.sh` pushes the tag),
  `release-pr.yml` (`scripts/release-pr.sh` pushes `release/<branch>`) and
  the hotfix job of `security-hotfix.yml` (it pushes the hotfix branches).
  The `workflow_run` trigger of `tag.yml` is accepted on purpose: it runs
  only after a successful CI push run on `main` or `hotfix/**` of this
  repository and checks out the head branch of that run (`main` or
  `hotfix/**`), never pull request code. So is the `pull_request_target`
  trigger of `release-ready.yml` (#147): it runs the workflow of `main`,
  checks out nothing, and only adds and removes a label on the release
  pull request of `main`.

* **[V]** `src/test/ci-release.test.ts` (#147) runs the shell of „Detect
  changes“ and of the CI Gate from `ci.yml` with bash and the inputs GitHub
  would give: the cheap run of the draft release pull request of `main`,
  its gate failing on purpose, every check required in every other release
  pull request, and every other pull request unchanged; it also checks that
  `ci.yml` keeps its event types and runs the step of `release-ready.yml`
  with a stub `gh`: label without the hotfix marker, refusal (draft and
  comment, no label) with it, nothing when the body cannot be read.
  `src/test/release-pr.test.ts` runs `scripts/release-pr.sh` in a
  throwaway repository with a stub `gh`: the release pull request of
  `main` is never marked ready, and its body carries the marker exactly
  while a released hotfix is not merged back.

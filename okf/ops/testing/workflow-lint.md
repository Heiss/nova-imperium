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
  **[E]** (owner, 2026-11-20, #303 option 1) The comment names the exact release (`# v7.0.1`), never a moving
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
  `hotfix/**`), never pull request code. (`release-ready.yml` with its
  `pull_request_target` trigger of #147 is gone with #387, 2026-11-23.)

* **[V]** `src/test/ci-release.test.ts` (#147) runs the shell of „Detect
  changes“ and of the CI Gate from `ci.yml` with bash and the inputs GitHub
  would give. Since #387: a release pull request (of `main` or of a hotfix
  branch) that changes only `VERSION`, `CHANGELOG.md` and `changes/` gets
  no expensive job, one that changes any other file fails „Detect
  changes“, and the gate refuses an expensive job in it; every other pull
  request is unchanged, and `ci.yml` keeps its event types and names no
  draft and no label of a full run.
  `src/test/release-pr.test.ts` runs `scripts/release-pr.sh` in a
  throwaway repository with a stub `gh`: the release pull request of
  `main` is never marked ready, and its body carries the marker exactly
  while a released hotfix is not merged back.
